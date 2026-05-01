// All money in cents (per CLAUDE.md). Display formats happen in UI.
const fmtMoney = (cents, { sign = false, abbrev = false } = {}) => {
  const v = Math.abs(cents) / 100;
  let body;
  if (abbrev && v >= 1000) {
    if (v >= 1_000_000) body = (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    else body = (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  } else {
    body = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const s = cents < 0 ? "−" : sign ? "+" : "";
  return `${s}R$ ${body}`;
};

const fmtDate = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

// Funding sources — credit cards, debit, vouchers, brokerage
const ACCOUNTS = [
  { id: "btg-cc",  name: "BTG Black",        type: "Credit card", short: "BTG CC",   last4: "8821", icon: "CreditCard", color: "#0F172A", balance: -3_842_55 },
  { id: "nu-cc",   name: "Nubank Roxinho",   type: "Credit card", short: "Nu CC",    last4: "0044", icon: "CreditCard", color: "#820AD1", balance: -1_204_18 },
  { id: "nu-deb",  name: "Nubank Débito",    type: "Debit",       short: "Nu Débito",last4: "9911", icon: "Wallet",     color: "#820AD1", balance: 4_212_30 },
  { id: "itau",    name: "Itaú Conta",       type: "Debit",       short: "Itaú",     last4: "4291", icon: "Wallet",     color: "#EC7000", balance: 8_640_00 },
  { id: "vr",      name: "VR Refeição",      type: "Voucher",     short: "VR Ref",   last4: "—",    icon: "Receipt",    color: "#22C55E", balance: 612_40 },
  { id: "alelo",   name: "Alelo Alimentação",type: "Voucher",     short: "Alelo",    last4: "—",    icon: "Receipt",    color: "#0EA5E9", balance: 408_90 },
  { id: "btg-inv", name: "BTG Investimentos",type: "Brokerage",   short: "BTG Inv",  last4: "—",    icon: "TrendingUp", color: "#FACC15", balance: 92_410_00 },
];

const CATEGORIES = [
  { id: "groc",   name: "Mercado",        color: "#15803D", icon: "ShoppingBag" },
  { id: "rent",   name: "Aluguel",        color: "#0EA5E9", icon: "Home" },
  { id: "salary", name: "Salário",        color: "#15803D", icon: "Briefcase" },
  { id: "dining", name: "Restaurantes",   color: "#EA580C", icon: "Coffee" },
  { id: "trans",  name: "Transporte",     color: "#A16207", icon: "Car" },
  { id: "stocks", name: "Ações",          color: "#6D28D9", icon: "TrendingUp" },
  { id: "subs",   name: "Assinaturas",    color: "#DB2777", icon: "Tag" },
  { id: "free",   name: "Freelance",      color: "#15803D", icon: "Sparkles" },
  { id: "util",   name: "Contas",         color: "#0891B2", icon: "Bolt" },
];

const TX = [
  { id: 1,  date: "2026-04-30", desc: "Salário — folha mensal",  category: "salary", account: "itau",   type: "earning",    amount: 12_400_00 },
  { id: 2,  date: "2026-04-29", desc: "Pão de Açúcar",            category: "groc",   account: "vr",     type: "expense",    amount: 187_42 },
  { id: 3,  date: "2026-04-29", desc: "Uber — Pinheiros → Vila Madalena", category: "trans", account: "nu-cc", type: "expense", amount: 28_60 },
  { id: 4,  date: "2026-04-28", desc: "Aporte mensal — IVVB11",   category: "stocks", account: "btg-inv",type: "investment", amount: 2_500_00 },
  { id: 5,  date: "2026-04-28", desc: "Spotify Família",          category: "subs",   account: "nu-cc",  type: "expense",    amount: 34_90 },
  { id: 6,  date: "2026-04-27", desc: "Tartine Padaria",          category: "dining", account: "alelo",  type: "expense",    amount: 48_20 },
  { id: 7,  date: "2026-04-26", desc: "Consultoria — fatura abr", category: "free",   account: "itau",   type: "earning",    amount: 3_800_00 },
  { id: 8,  date: "2026-04-25", desc: "Enel — energia",           category: "util",   account: "itau",   type: "expense",    amount: 312_18 },
  { id: 9,  date: "2026-04-25", desc: "Carrefour",                category: "groc",   account: "vr",     type: "expense",    amount: 224_77 },
  { id: 10, date: "2026-04-24", desc: "Bilhete Único — recarga",  category: "trans",  account: "nu-deb", type: "expense",    amount: 80_00 },
  { id: 11, date: "2026-04-23", desc: "Outback Teodoro Sampaio",  category: "dining", account: "btg-cc", type: "expense",    amount: 312_50 },
  { id: 12, date: "2026-04-22", desc: "Aluguel — abril",          category: "rent",   account: "itau",   type: "expense",    amount: 4_200_00 },
  { id: 13, date: "2026-04-21", desc: "Aporte tesouro IPCA+ 2035",category: "stocks", account: "btg-inv",type: "investment", amount: 1_500_00 },
  { id: 14, date: "2026-04-20", desc: "Netflix",                  category: "subs",   account: "nu-cc",  type: "expense",    amount: 55_90 },
  { id: 15, date: "2026-04-19", desc: "iFood — almoço sábado",    category: "dining", account: "btg-cc", type: "expense",    amount: 64_25 },
  { id: 16, date: "2026-04-18", desc: "Posto Shell — gasolina",   category: "trans",  account: "btg-cc", type: "expense",    amount: 218_40 },
  { id: 17, date: "2026-04-17", desc: "Hortifruti",               category: "groc",   account: "vr",     type: "expense",    amount: 142_30 },
  { id: 18, date: "2026-04-16", desc: "AWS — projeto pessoal",    category: "util",   account: "nu-cc",  type: "expense",    amount: 89_40 },
];

// 12-week cash flow series (in R$)
const CASHFLOW = [
  { w: "Fev 02", in: 12400, out: 6890 },
  { w: "Fev 09", in: 1650,  out: 2240 },
  { w: "Fev 16", in: 0,     out: 3120 },
  { w: "Fev 23", in: 480,   out: 1950 },
  { w: "Mar 02", in: 12400, out: 7580 },
  { w: "Mar 09", in: 2850,  out: 2390 },
  { w: "Mar 16", in: 0,     out: 3210 },
  { w: "Mar 23", in: 320,   out: 1670 },
  { w: "Mar 30", in: 12400, out: 8940 },
  { w: "Abr 06", in: 1500,  out: 2240 },
  { w: "Abr 13", in: 0,     out: 3120 },
  { w: "Abr 20", in: 3800,  out: 4890 },
];

const NETWORTH = [
  { m: "Mai", v: 178400 }, { m: "Jun", v: 179100 }, { m: "Jul", v: 181800 },
  { m: "Ago", v: 183200 }, { m: "Set", v: 185700 }, { m: "Out", v: 184900 },
  { m: "Nov", v: 188200 }, { m: "Dez", v: 191500 }, { m: "Jan", v: 194800 },
  { m: "Fev", v: 197300 }, { m: "Mar", v: 199800 }, { m: "Abr", v: 213509 },
];

const CATEGORY_SPEND = [
  { cat: "rent",   amount: 4200_00 },
  { cat: "groc",   amount: 554_49 },
  { cat: "dining", amount: 424_95 },
  { cat: "trans",  amount: 327_00 },
  { cat: "util",   amount: 401_58 },
  { cat: "subs",   amount: 90_80 },
];

Object.assign(window, { fmtMoney, fmtDate, ACCOUNTS, CATEGORIES, TX, CASHFLOW, NETWORTH, CATEGORY_SPEND });
