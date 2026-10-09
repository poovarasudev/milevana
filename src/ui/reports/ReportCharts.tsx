// Report building blocks (PD-06/PD-07): section cards, the Show-as-table
// toggle every chart carries, simple tables, proportional split bars and
// fact rows. Charts themselves are react-native-gifted-charts; taps on a bar
// or point surface its value below the chart (PD-07, D4).

import { ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatAmount } from '../../domain/money';
import { t } from '../../i18n';
import { Card, Icon, T } from '../kit';
import { useTheme } from '../theme';

/** Titled card wrapping one report section. */
export function ReportSection({ title, testID, children }: {
  title: string; testID?: string; children: ReactNode;
}) {
  return (
    <View testID={testID}>
      <Card style={{ marginHorizontal: 20, gap: 12 }}>
        <T size={13} weight="bold" style={{ letterSpacing: 1.1 }}>{title.toUpperCase()}</T>
        {children}
      </Card>
    </View>
  );
}

/** 'No data for this period' — a section keeps its header (PD-06). */
export function SectionEmpty() {
  const th = useTheme();
  return <T size={13} color={th.muted} testID="report-section-empty">{t('reports.noData')}</T>;
}

/** label + value fact row used inside sections. */
export function FactRow({ label, value, bold, valueColor }: {
  label: string; value: string; bold?: boolean; valueColor?: string;
}) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <T size={13} color={th.muted} style={{ flex: 1 }} numberOfLines={2}>{label}</T>
      <T size={bold ? 18 : 14} weight={bold ? 'bold' : 'semi'} color={valueColor}>{value}</T>
    </View>
  );
}

/** Plain table for the Show-as-table alternative (PD-07). */
export function DataTable({ head, rows, testID }: {
  head: string[]; rows: (string | number)[][]; testID?: string;
}) {
  const th = useTheme();
  const cell = (v: string | number, i: number, header?: boolean) => (
    <T
      key={i}
      size={12}
      weight={header ? 'bold' : i === 0 ? 'semi' : 'medium'}
      color={header ? th.muted : i === 0 ? th.text : th.muted}
      style={{ flex: i === 0 ? 1.4 : 1, textAlign: i === 0 ? 'left' : 'right' }}
      numberOfLines={1}
    >
      {v}
    </T>
  );
  return (
    <View testID={testID} style={{ borderWidth: 1, borderColor: th.border, borderRadius: 12, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', backgroundColor: th.tile, paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
        {head.map((h, i) => cell(h, i, true))}
      </View>
      {rows.map((r, ri) => (
        <View
          key={ri}
          style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderTopWidth: 1, borderTopColor: th.divider }}
        >
          {r.map((v, i) => cell(v, i))}
        </View>
      ))}
    </View>
  );
}

/** Wraps a chart: Show-as-table toggle, legend dots and the tapped value
 *  line (PD-07). `tableRows` mirrors the chart's data. */
export function ChartBlock({ tableHead, tableRows, legend, selected, children, testID }: {
  tableHead: string[];
  tableRows: (string | number)[][];
  legend?: { color: string; label: string }[];
  selected?: string | null;
  children: ReactNode;
  testID?: string;
}) {
  const th = useTheme();
  const [table, setTable] = useState(false);
  return (
    <View style={{ gap: 8 }} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {(legend ?? []).map((l) => (
            <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
              <T size={11} color={th.muted} numberOfLines={1}>{l.label}</T>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={table ? t('reports.showChart') : t('reports.showTable')}
          testID={table ? 'chart-toggle-chart' : 'chart-toggle-table'}
          onPress={() => setTable(!table)}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={table ? 'chart-line' : 'table'} color={th.primary} size={20} />
        </Pressable>
      </View>
      {table ? <DataTable head={tableHead} rows={tableRows} testID="chart-table" /> : children}
      {selected ? <T size={12} weight="semi" color={th.primary} testID="chart-selected">{selected}</T> : null}
    </View>
  );
}

/** One stacked horizontal bar + label/amount rows — the "list with
 *  proportional bar" split (PD-04). */
export function SplitBar({ rows, currency, testID }: {
  rows: { label: string; minor: number; color: string }[];
  currency: string;
  testID?: string;
}) {
  const th = useTheme();
  const total = rows.reduce((s, r) => s + Math.max(0, r.minor), 0);
  return (
    <View style={{ gap: 8 }} testID={testID}>
      {total > 0 ? (
        <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' }}>
          {rows.filter((r) => r.minor > 0).map((r) => (
            <View key={r.label} style={{ flex: r.minor / total, backgroundColor: r.color }} />
          ))}
        </View>
      ) : null}
      {rows.map((r) => (
        <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.color }} />
          <T size={13} color={th.text} style={{ flex: 1 }} numberOfLines={1}>{r.label}</T>
          <T size={13} weight="semi">{formatAmount({ minor: r.minor, currency })}</T>
        </View>
      ))}
    </View>
  );
}
