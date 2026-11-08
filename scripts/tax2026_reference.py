"""Reference implementation of the Romanian 2026 tax rules used by the 2026 workbook and the app.

Written independently of the Excel formulas: the workbook (and later the TypeScript engine)
must reproduce these numbers. Values come from data/params-2026.json; the legal basis of each
value is recorded there.

Conventions
- Contributions on non-salary income use annual thresholds based on the minimum wage in force
  on 1 January 2026 (SalMinRef), even though the minimum wage rose on 1 July 2026.
- Salary taxes are monthly and rounded to whole lei, half up (ANAF D112 convention); the
  minimum wage, the non-taxable amount and the personal deduction differ between
  January-June (half 1) and July-December (half 2).
- Steady state: a company is assumed to have had the same revenue in 2025, so revenue above
  the micro ceiling means profit tax for the whole year.

Run as a script to write data/golden-2026.json.
"""
from __future__ import annotations

import json
import math
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_params(path: Path = ROOT / "data" / "params-2026.json") -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {p["key"]: p["value"] for p in data["params"]}


P = load_params()


def rnd(x: float) -> int:
    """Round to whole lei, half up (ignores binary noise such as 992.2499999999)."""
    return int(Decimal(repr(round(x, 6))).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def mw(n: float) -> float:
    """n reference minimum wages (annual thresholds for income year 2026)."""
    return n * P["SalMinRef"]


# --- Employee (monthly) --------------------------------------------------------------------

def employee_month(gross: float, half: int, dependants: int = 0, under26: bool = False,
                   school_children: int = 0) -> dict:
    MW = P["SalMin"] if half == 1 else P["SalMinIul"]
    nt_amount = P["SumaNetax1"] if half == 1 else P["SumaNetax2"]
    nt_ceiling = P["PlafonNetax1"] if half == 1 else P["PlafonNetax2"]
    nt = nt_amount if MW <= gross <= nt_ceiling else 0
    base = gross - nt
    cas = rnd(base * P["CotaCAS"])
    cass = rnd(base * P["CotaCASS"])

    pct = (0.20, 0.25, 0.30, 0.35, 0.45)[min(dependants, 4)]
    if gross > MW + P["DedPlafon"]:
        pct = 0.0
    elif gross > MW:
        pct = max(0.0, pct - 0.005 * math.ceil((gross - MW) / 50))
    deduction = rnd(pct * MW) + P["DedCopil"] * school_children
    if under26 and gross <= MW + P["DedPlafon"]:
        deduction += rnd(P["DedU26"] * MW)
    before_deduction = max(0, base - cas - cass)
    deduction = min(deduction, before_deduction)
    tax = rnd((before_deduction - deduction) * P["CotaImpozit"])
    cam = rnd(base * P["CotaCAM"])
    # Under the minimum base the employer pays the rest of CAS and CASS (art. 146 alin. (5^6), (5^9)); the net stays.
    floor = MW - nt_amount
    top_up = rnd(floor * P["CotaCAS"]) - cas + rnd(floor * P["CotaCASS"]) - cass if 0 < gross < floor else 0
    return {"gross": gross, "mw": MW, "nontaxable": nt, "cas": cas, "cass": cass,
            "deduction": deduction, "tax": tax, "net": gross - cas - cass - tax,
            "cam": cam, "employer_top_up": top_up, "employer_cost": gross + cam + top_up}


def employee_year(gross: float, **kw) -> dict:
    h1, h2 = employee_month(gross, 1, **kw), employee_month(gross, 2, **kw)
    return {k: 6 * h1[k] + 6 * h2[k] for k in ("gross", "cas", "cass", "tax", "net", "cam", "employer_top_up", "employer_cost")}


# --- Contributions on non-salary income (income year 2026) ----------------------------------

def cas_band(net: float) -> float:
    """CAS on independent activities and IP income: fixed amount per band (minimum chosen base)."""
    # To the ban: revenue less expenses can come out a hair under a band it is exactly on (66,002.40 - 17,402.40).
    net = round(net, 2)
    if net >= mw(P["PragCAS2"]):
        return mw(P["PragCAS2"]) * P["CotaCAS"]
    if net >= mw(P["PragCAS1"]):
        return mw(P["PragCAS1"]) * P["CotaCAS"]
    return 0.0


def cass_pfa(net: float, waived: bool = False) -> tuple[float, float]:
    """CASS on independent activities: (total due, part computed on actual income).

    10% of net income capped at 72 minimum wages, topped up to 6 minimum wages unless the
    person has a salary of at least 6 minimum wages or a pension. Only the part computed on
    actual income is deductible from the income tax base (Fiscal Code art. 118).
    """
    if net <= 0:
        return 0.0, 0.0
    on_income = min(net, mw(P["CASSMaxPFA"])) * P["CotaCASS"]
    total = on_income if waived else max(on_income, mw(P["CASSMinPFA"]) * P["CotaCASS"])
    return total, on_income


def cass_tiers(amount: float) -> float:
    """CASS on dividends, IP and other income: band base of 6/12/24 minimum wages."""
    for n in (P["CASSPrag3"], P["CASSPrag2"], P["CASSPrag1"]):
        if amount >= mw(n):
            return mw(n) * P["CotaCASS"]
    return 0.0


# --- PFA (annual) ---------------------------------------------------------------------------

def pfa_year(revenue: float, expenses: float = 0, norm: float | None = None,
             has_salary: bool = False, pensioner: bool = False) -> dict:
    """Real system by default; pass `norm` for the income-norm system (no deductions, floor of 12 minimum wages)."""
    real = norm is None
    net = max(0.0, revenue - expenses) if real else max(norm, mw(P["NormaMin"]))
    cas = 0.0 if pensioner else cas_band(net)
    cass, cass_on_income = cass_pfa(net, waived=has_salary or pensioner)
    deductible = (cas + cass_on_income) if real and P["PFADeduceCASCASS"] == "Da" else 0.0
    tax = max(0.0, net - deductible) * P["CotaImpozit"]
    take_home = revenue - expenses - cas - cass - tax
    return {"revenue": revenue, "net_income": net, "cas": cas, "cass": cass, "tax": tax,
            "take_home": take_home}


# --- SRL (annual) ---------------------------------------------------------------------------

def owner_salary_year(employed: bool) -> dict:
    if not employed:
        return {"gross": 0, "cam": 0, "net": 0}
    h1, h2 = employee_month(P["SalMin"], 1), employee_month(P["SalMinIul"], 2)
    return {"gross": 6 * P["SalMin"] + 6 * P["SalMinIul"],
            "cam": 6 * h1["cam"] + 6 * h2["cam"], "net": 6 * h1["net"] + 6 * h2["net"]}


def micro_eligible(revenue: float, owner_employed: bool, other_employee: bool = False,
                   single_micro: bool = True) -> bool:
    ceiling = round(P["PlafonMicroEUR"] * P["CursEURPlafon"], 2)
    return revenue <= ceiling and (owner_employed or other_employee) and single_micro


def srl_year(revenue: float, expenses: float = 0, owner_employed: bool = True,
             other_employee: bool = False, single_micro: bool = True,
             chose_profit_tax: bool = False) -> dict:
    sal = owner_salary_year(owner_employed)
    micro = (not chose_profit_tax) and micro_eligible(revenue, owner_employed, other_employee, single_micro)
    if micro:
        company_tax = revenue * P["CotaMicro"]
    else:
        company_tax = max(0.0, revenue - expenses - sal["gross"] - sal["cam"]) * P["CotaProfit"]
    profit = revenue - expenses - sal["gross"] - sal["cam"] - company_tax
    dividends = max(0.0, profit)
    dividend_tax = dividends * P["CotaDividende"]
    net_dividends = dividends - dividend_tax
    cass = cass_tiers(net_dividends)
    # A loss (revenue not covering the owner's salary and its taxes) comes out of the owner's pocket.
    take_home = net_dividends - cass + sal["net"] + min(0.0, profit)
    return {"regime": "micro" if micro else "profit", "revenue": revenue, "salary_gross": sal["gross"],
            "cam": sal["cam"], "company_tax": company_tax, "profit": profit,
            "dividend_tax": dividend_tax, "net_dividends": net_dividends, "cass_dividends": cass,
            "salary_net": sal["net"], "take_home": take_home}


# --- Copyright / IP income (annual) ----------------------------------------------------------

def copyright_year(gross: float, employee_or_pensioner: bool = False) -> dict:
    net = gross * (1 - P["CotaForfetaraDA"])
    tax = net * P["CotaImpozit"]
    cas = 0.0 if employee_or_pensioner else cas_band(net)
    cass = 0.0 if employee_or_pensioner else cass_tiers(net)
    return {"gross": gross, "net_income": net, "tax": tax, "cas": cas, "cass": cass,
            "take_home": gross - tax - cas - cass}


def copyright_gross_for_net(target: float, employee_or_pensioner: bool = False) -> float:
    """Smallest annual gross whose take-home is at least `target` (bands create cliffs)."""
    keep = 1 - (1 - P["CotaForfetaraDA"]) * P["CotaImpozit"]
    if employee_or_pensioner:
        return target / keep
    best = None
    for low, high in ((0, P["CASSPrag1"]), (P["CASSPrag1"], P["PragCAS1"]),
                      (P["PragCAS1"], P["PragCAS2"]), (P["PragCAS2"], None)):
        probe = mw(low) if low else 0.0
        fixed = cas_band(probe) + cass_tiers(probe)
        gross = (target + fixed) / keep
        net = gross * (1 - P["CotaForfetaraDA"])
        if net >= mw(low) and (high is None or net < mw(high)):
            best = gross if best is None else min(best, gross)
    return best


# --- Scenarios shared with the workbook's comparison sheet ----------------------------------

def compare(monthly_gross: float) -> dict:
    annual = 12 * monthly_gross
    out = {
        "Salariat": employee_year(monthly_gross)["net"],
        "PFA": pfa_year(annual)["take_home"],
        "SRL micro": srl_year(annual, owner_employed=True)["take_home"],
        "SRL profit cu salariu": srl_year(annual, owner_employed=True, chose_profit_tax=True)["take_home"],
        "SRL profit fara salariu": srl_year(annual, owner_employed=False, chose_profit_tax=True)["take_home"],
        "Drepturi de autor": copyright_year(annual)["take_home"],
    }
    return {k: v / 12 for k, v in out.items()}


def eur_per_hour_to_monthly_lei(rate: float, hours_day=8, days_week=5, weeks_year=52) -> float:
    return rate * hours_day * days_week * weeks_year / 12 * P["CursEUR"]


def case(fn, **inputs) -> dict:
    """One case: its inputs by `fn`'s parameter names, which the tests hand to the engine, and what `fn` gives."""
    return {"input": inputs, "expected": fn(**inputs)}


def golden() -> dict:
    scenarios = {"5000": 5000, "10000": 10000, "20000": 20000,
                 "30 EUR/h": eur_per_hour_to_monthly_lei(30)}
    return {
        "employee_month": {
            "4050 H1": case(employee_month, gross=4050, half=1),
            "4325 H2": case(employee_month, gross=4325, half=2),
            "5000 H1": case(employee_month, gross=5000, half=1),
            "5000 H2": case(employee_month, gross=5000, half=2),
            "10000 H2": case(employee_month, gross=10000, half=2),
            "6000 H1 2 dep u26 1 child": case(employee_month, gross=6000, half=1, dependants=2, under26=True,
                                              school_children=1),
            # The edges: the untaxed amount up to its ceiling, a salary under the minimum, the deduction table's
            # last step (minimum wage + 2,000) and past it, and the under-26 deduction on both sides of that step.
            "4300 H1": case(employee_month, gross=4300, half=1),
            "4600 H2": case(employee_month, gross=4600, half=2),
            "3000 H1": case(employee_month, gross=3000, half=1),
            "5000 H2 3 dep": case(employee_month, gross=5000, half=2, dependants=3),
            "6050 H1 4 dep": case(employee_month, gross=6050, half=1, dependants=4),
            "6051 H1 4 dep": case(employee_month, gross=6051, half=1, dependants=4),
            "6325 H2 1 dep": case(employee_month, gross=6325, half=2, dependants=1),
            "6050 H1 u26": case(employee_month, gross=6050, half=1, under26=True),
            "10000 H1 u26": case(employee_month, gross=10000, half=1, under26=True),
            "10000 H2 u26": case(employee_month, gross=10000, half=2, under26=True),
        },
        "owner_salary_year": owner_salary_year(True),
        "compare_monthly": {name: compare(x) for name, x in scenarios.items()},
        "scenario_monthly_gross": scenarios,
        "pfa": {str(r): pfa_year(r) for r in (20000, 48600, 97200, 120000, 300000, 400000)},
        # The options the cards offer, each where it changes the result.
        "pfa_options": {
            "100000 norm 48600": case(pfa_year, revenue=100000, norm=48600),
            "100000 norm 20000": case(pfa_year, revenue=100000, norm=20000),
            "100000 norm 72000": case(pfa_year, revenue=100000, norm=72000),
            "100000 norm 48600 pensioner": case(pfa_year, revenue=100000, norm=48600, pensioner=True),
            "100000 pensioner": case(pfa_year, revenue=100000, pensioner=True),
            "20000 pensioner": case(pfa_year, revenue=20000, pensioner=True),
            "12000 has salary": case(pfa_year, revenue=12000, has_salary=True),
            "120000 expenses 12000": case(pfa_year, revenue=120000, expenses=12000),
            "66002.40 expenses 17402.40": case(pfa_year, revenue=66002.4, expenses=17402.4),
        },
        "srl": {str(r): srl_year(r) for r in (100000, 300000, 509850, 600000)},
        "srl_options": {
            "300000 micro expenses 60000": case(srl_year, revenue=300000, expenses=60000),
            "300000 profit expenses 60000": case(srl_year, revenue=300000, expenses=60000, chose_profit_tax=True),
            "600000 profit no salary expenses 120000": case(srl_year, revenue=600000, expenses=120000,
                                                            owner_employed=False, chose_profit_tax=True),
            "300000 no employee": case(srl_year, revenue=300000, owner_employed=False),
            "300000 another employee": case(srl_year, revenue=300000, owner_employed=False, other_employee=True),
            "300000 not the only micro": case(srl_year, revenue=300000, single_micro=False),
        },
        "copyright": {str(g): copyright_year(g) for g in (40000, 40500, 81000, 162000, 200000)},
        "copyright_options": {
            "60000 employee or pensioner": case(copyright_year, gross=60000, employee_or_pensioner=True),
            "200000 employee or pensioner": case(copyright_year, gross=200000, employee_or_pensioner=True),
        },
        "copyright_gross_for_net": {str(t): copyright_gross_for_net(t) for t in (38000, 60000, 100000)},
        "copyright_gross_for_net_options": {
            "50000 employee or pensioner": case(copyright_gross_for_net, target=50000, employee_or_pensioner=True),
        },
    }


if __name__ == "__main__":
    out = ROOT / "data" / "golden-2026.json"
    out.write_text(json.dumps(golden(), indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {out}")
