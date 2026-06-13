import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, AreaChart, Area,
} from 'recharts'
import { CHART_COLORS, categoryMeta } from '@/lib/constants'
import { formatMoney } from '@/lib/utils'

const axisProps = { stroke: 'hsl(215 16% 47%)', fontSize: 11, tickLine: false, axisLine: false }

function MoneyTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lift">
      {label ? <p className="mb-1 font-semibold">{label}</p> : null}
      {payload.map((p) => (
        <p key={p.dataKey || p.name} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{formatMoney(p.value, currency)}</span>
        </p>
      ))}
    </div>
  )
}

const compact = (v) => new Intl.NumberFormat('en', { notation: 'compact' }).format(v)

export function ExpensePie({ data, currency, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={3} strokeWidth={0}>
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={categoryMeta('expense', entry.name)?.color || CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<MoneyTooltip currency={currency} />} />
        <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function IncomeExpenseBars({ data, currency, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={3}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(215 20% 60% / 0.18)" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={compact} width={42} />
        <Tooltip content={<MoneyTooltip currency={currency} />} cursor={{ fill: 'hsl(215 20% 60% / 0.08)' }} />
        <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
        <Bar name="Income" dataKey="income" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={26} />
        <Bar name="Expenses" dataKey="expense" fill="#f43f5e" radius={[5, 5, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function SpendingLine({ data, currency, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(215 20% 60% / 0.18)" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={compact} width={42} />
        <Tooltip content={<MoneyTooltip currency={currency} />} />
        <Line name="Spending" type="monotone" dataKey="expense" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function SavingsArea({ data, currency, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="savewiseGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(215 20% 60% / 0.18)" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={compact} width={42} />
        <Tooltip content={<MoneyTooltip currency={currency} />} />
        <Area name="Net saved" type="monotone" dataKey="saved" stroke="#10b981" strokeWidth={2.5} fill="url(#savewiseGreen)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
