// The six report sections (RPT-06..RPT-12, PD-03..PD-07): overview figures,
// stacked monthly spend, fuel trends, services & expenses, income & profit
// and trips — rendered identically for a single vehicle and for each
// currency block of an all-vehicles report (PD-08).

import { useState } from 'react';
import { View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { tsFromMillis } from '../../data/schema/common';
import { formatMileage } from '../../domain/fuel';
import { formatAmount, formatRate, minorToDecimal } from '../../domain/money';
import type { ReportFigures } from '../../domain/reports';
import type { StoredDistanceUnit } from '../../domain/units';
import { KM_PER_MILE } from '../../domain/units';
import { formatDate, useSettings } from '../../features/format';
import { t } from '../../i18n';
import { T } from '../kit';
import { useTheme } from '../theme';
import {
  PALETTE, distText, monthLong, monthShort, priceText, priceValue, rateText, seriesLabel,
} from './reportDisplay';
import { ChartBlock, FactRow, ReportSection, SectionEmpty, SplitBar } from './ReportCharts';

const UNIT_ORDER: StoredDistanceUnit[] = ['km', 'mi', 'hours'];
const CHART_H = 180;

function MonthlySpend({ r, currency }: { r: ReportFigures; currency: string }) {
  const th = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const has = r.monthly.some((m) => m.fuel + m.service + m.expense > 0);
  if (!has) return <SectionEmpty />;
  const major = (minor: number) => minorToDecimal(minor, currency);
  const fmt = (minor: number) => formatAmount({ minor, currency });

  const stackData = r.monthly.map((m) => ({
    label: monthShort(m.year, m.month),
    stacks: [
      { value: Math.max(0, major(m.fuel)), color: PALETTE.fuel, onPress: () => setSelected(t('reports.chartValue', { label: `${monthLong(m.year, m.month)} · ${t('reports.fuelSeg')}`, value: fmt(m.fuel) })) },
      { value: Math.max(0, major(m.service)), color: PALETTE.service, onPress: () => setSelected(t('reports.chartValue', { label: `${monthLong(m.year, m.month)} · ${t('reports.kindService')}`, value: fmt(m.service) })) },
      { value: Math.max(0, major(m.expense)), color: PALETTE.expense, onPress: () => setSelected(t('reports.chartValue', { label: `${monthLong(m.year, m.month)} · ${t('reports.kindExpense')}`, value: fmt(m.expense) })) },
    ],
  }));

  return (
    <ChartBlock
      testID="chart-monthly-spend"
      legend={[
        { color: PALETTE.fuel, label: t('reports.fuelSeg') },
        { color: PALETTE.service, label: t('reports.kindService') },
        { color: PALETTE.expense, label: t('reports.kindExpense') },
      ]}
      tableHead={[t('reports.monthCol'), t('reports.fuelSeg'), t('reports.kindService'), t('reports.kindExpense')]}
      tableRows={r.monthly.map((m) => [monthLong(m.year, m.month), fmt(m.fuel), fmt(m.service), fmt(m.expense)])}
      selected={selected}
    >
      <BarChart
        stackData={stackData}
        height={CHART_H}
        barWidth={r.monthly.length > 8 ? 14 : 22}
        spacing={r.monthly.length > 8 ? 26 : 36}
        noOfSections={4}
        isAnimated={false}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={th.divider}
        xAxisLabelTextStyle={{ color: th.muted, fontSize: 10 }}
        yAxisTextStyle={{ color: th.muted, fontSize: 10 }}
        rulesColor={th.divider}
        hideRules={false}
        barBorderRadius={3}
      />
    </ChartBlock>
  );
}

function MileageTrend({ r, multi }: { r: ReportFigures; multi: boolean }) {
  const th = useTheme();
  const settings = useSettings();
  const [selected, setSelected] = useState<string | null>(null);
  const series = r.fuel.mileage.filter((s) => s.points.length > 0);
  if (series.length === 0) return null;

  const dataSet = series.map((s, si) => {
    const color = PALETTE.series[si % PALETTE.series.length];
    const step = Math.max(1, Math.ceil(s.points.length / 8));
    return {
      data: s.points.map((p, i) => ({
        value: s.unit === 'mi' ? p.value * KM_PER_MILE : p.value,
        label: i % step === 0 ? shortDate(p.ms) : undefined,
        onPress: () => setSelected(t('reports.chartValue', {
          label: `${seriesLabel(s, multi)} · ${formatDate(tsFromMillis(p.ms), settings.dateFormat)}`,
          value: formatMileage(p.value, s.fuelType, s.unit, settings) ?? '—',
        })),
      })),
      color,
      thickness: 2,
      dataPointsColor: color,
      dataPointsRadius: 4,
      startFillColor: color,
    };
  });

  const rows = series.flatMap((s) =>
    s.points.map((p) => [
      seriesLabel(s, multi),
      formatDate(tsFromMillis(p.ms), settings.dateFormat),
      formatMileage(p.value, s.fuelType, s.unit, settings) ?? '—',
    ]),
  );

  return (
    <View style={{ gap: 12 }}>
      <T size={13} weight="semi">{t('reports.mileageTrend')}</T>
      <ChartBlock
        testID="chart-mileage"
        legend={series.map((s, si) => ({ color: PALETTE.series[si % PALETTE.series.length], label: seriesLabel(s, multi) }))}
        tableHead={[t('reports.seriesCol'), t('reports.dateCol'), t('reports.valueCol')]}
        tableRows={rows}
        selected={selected}
      >
        <LineChart
          dataSet={dataSet}
          height={CHART_H}
          spacing={48}
          noOfSections={4}
          isAnimated={false}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={th.divider}
          xAxisLabelTextStyle={{ color: th.muted, fontSize: 10 }}
          yAxisTextStyle={{ color: th.muted, fontSize: 10 }}
          rulesColor={th.divider}
        />
      </ChartBlock>
    </View>
  );
}

function PriceTrend({ r, currency, multi }: { r: ReportFigures; currency: string; multi: boolean }) {
  const th = useTheme();
  const settings = useSettings();
  const [selected, setSelected] = useState<string | null>(null);
  const series = r.fuel.price.filter((s) => s.points.length > 0);
  if (series.length === 0) return null;

  const dataSet = series.map((s, si) => {
    const color = PALETTE.series[si % PALETTE.series.length];
    const step = Math.max(1, Math.ceil(s.points.length / 8));
    return {
      data: s.points.map((p, i) => ({
        value: priceValue(p.pricePerUnitMilli, p.unit, s.fuelType, settings),
        label: i % step === 0 ? shortDate(p.ms) : undefined,
        onPress: () => setSelected(t('reports.chartValue', {
          label: `${seriesLabel(s, multi)} · ${formatDate(tsFromMillis(p.ms), settings.dateFormat)}`,
          value: priceText(p.pricePerUnitMilli, p.unit, s.fuelType, currency, settings),
        })),
      })),
      color,
      thickness: 2,
      dataPointsColor: color,
      dataPointsRadius: 4,
    };
  });

  const rows = series.flatMap((s) =>
    s.points.map((p) => [
      seriesLabel(s, multi),
      formatDate(tsFromMillis(p.ms), settings.dateFormat),
      priceText(p.pricePerUnitMilli, p.unit, s.fuelType, currency, settings),
    ]),
  );

  return (
    <View style={{ gap: 12 }}>
      <T size={13} weight="semi">{t('reports.priceTrend')}</T>
      <ChartBlock
        testID="chart-price"
        legend={series.map((s, si) => ({ color: PALETTE.series[si % PALETTE.series.length], label: seriesLabel(s, multi) }))}
        tableHead={[t('reports.seriesCol'), t('reports.dateCol'), t('reports.valueCol')]}
        tableRows={rows}
        selected={selected}
      >
        <LineChart
          dataSet={dataSet}
          height={CHART_H}
          spacing={48}
          noOfSections={4}
          isAnimated={false}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={th.divider}
          xAxisLabelTextStyle={{ color: th.muted, fontSize: 10 }}
          yAxisTextStyle={{ color: th.muted, fontSize: 10 }}
          rulesColor={th.divider}
        />
      </ChartBlock>
    </View>
  );
}

function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${t(`history.months.${d.getMonth()}`).slice(0, 3)}`;
}

function IncomeBars({ r, currency }: { r: NonNullable<ReportFigures['income']>; currency: string }) {
  const th = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const major = (minor: number) => minorToDecimal(minor, currency);
  const fmt = (minor: number) => formatAmount({ minor, currency });

  const data = r.monthly.flatMap((m) => [
    {
      value: Math.max(0, major(m.income)),
      frontColor: PALETTE.income,
      label: monthShort(m.year, m.month),
      onPress: () => setSelected(t('reports.chartValue', { label: `${monthLong(m.year, m.month)} · ${t('reports.income')}`, value: fmt(m.income) })),
    },
    {
      value: Math.max(0, major(m.cost)),
      frontColor: PALETTE.cost,
      onPress: () => setSelected(t('reports.chartValue', { label: `${monthLong(m.year, m.month)} · ${t('reports.cost')}`, value: fmt(m.cost) })),
    },
  ]);

  return (
    <View style={{ gap: 12 }}>
      <T size={13} weight="semi">{t('reports.incomeVsCost')}</T>
      <ChartBlock
        testID="chart-income"
        legend={[
          { color: PALETTE.income, label: t('reports.income') },
          { color: PALETTE.cost, label: t('reports.cost') },
        ]}
        tableHead={[t('reports.monthCol'), t('reports.income'), t('reports.cost')]}
        tableRows={r.monthly.map((m) => [monthLong(m.year, m.month), fmt(m.income), fmt(m.cost)])}
        selected={selected}
      >
        <BarChart
          data={data}
          height={CHART_H}
          barWidth={r.monthly.length > 6 ? 10 : 14}
          spacing={r.monthly.length > 6 ? 14 : 20}
          noOfSections={4}
          isAnimated={false}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={th.divider}
          xAxisLabelTextStyle={{ color: th.muted, fontSize: 10 }}
          yAxisTextStyle={{ color: th.muted, fontSize: 10 }}
          rulesColor={th.divider}
          barBorderRadius={3}
        />
      </ChartBlock>
    </View>
  );
}

/** All six sections of one report scope (single vehicle or currency block). */
export function ReportFiguresView({ r, currency, multi }: {
  r: ReportFigures;
  currency: string;
  multi: boolean;
}) {
  const th = useTheme();
  const settings = useSettings();
  const fmt = (minor: number) => formatAmount({ minor, currency });
  const o = r.overview;
  const units = UNIT_ORDER.filter((u) => o.distanceByUnit[u] !== undefined || o.costMinorByUnit[u] !== undefined);
  const evTotal = r.fuel.ev.home + r.fuel.ev.public + r.fuel.ev.unspecified;

  return (
    <View style={{ gap: 16 }}>
      <ReportSection title={t('reports.section.overview')} testID="report-section-overview">
        <FactRow label={t('reports.totalCost')} value={fmt(o.costMinor)} bold />
        {units.map((u) => (
          <View key={u} style={{ gap: 8 }}>
            {o.distanceByUnit[u] !== undefined ? (
              <FactRow
                label={multi ? t('reports.distanceForUnit', { unit: t(`units.${u}`) }) : t('reports.distance')}
                value={distText(o.distanceByUnit[u]!, u, settings)}
              />
            ) : null}
            {o.costPerKmByUnit[u as 'km' | 'mi'] !== undefined ? (
              <FactRow
                label={multi ? t('reports.costPerUnitForUnit', { unit: t(`units.${u}`), group: t(`units.${u}`) }) : t('reports.costPerUnit', { unit: t(`units.${u}`) })}
                value={rateText(o.costPerKmByUnit[u as 'km' | 'mi']!, currency, u, settings)}
              />
            ) : null}
          </View>
        ))}
        {o.costPerDayMinor !== undefined ? (
          <FactRow label={t('reports.costPerDay')} value={formatRate(o.costPerDayMinor, currency)} />
        ) : null}
        <T size={13} weight="semi" style={{ marginTop: 4 }}>{t('reports.splitByType')}</T>
        <SplitBar
          currency={currency}
          rows={[
            { label: t('reports.fuelSeg'), minor: o.split.fuel, color: PALETTE.fuel },
            { label: t('reports.kindService'), minor: o.split.service, color: PALETTE.service },
            { label: t('reports.kindExpense'), minor: o.split.expense, color: PALETTE.expense },
          ]}
        />
      </ReportSection>

      <ReportSection title={t('reports.section.monthlySpend')} testID="report-section-monthly">
        <MonthlySpend r={r} currency={currency} />
      </ReportSection>

      <ReportSection title={t('reports.section.fuel')} testID="report-section-fuel">
        {r.counts.fuel === 0 ? <SectionEmpty /> : (
          <View style={{ gap: 16 }}>
            {UNIT_ORDER.filter((u) => r.fuel.costPerKmByUnit[u as 'km' | 'mi'] !== undefined).map((u) => (
              <FactRow
                key={u}
                label={t('reports.fuelCostPerUnit', { unit: t(`units.${u}`) })}
                value={rateText(r.fuel.costPerKmByUnit[u as 'km' | 'mi']!, currency, u, settings)}
              />
            ))}
            <MileageTrend r={r} multi={multi} />
            <PriceTrend r={r} currency={currency} multi={multi} />
            {evTotal > 0 ? (
              <View style={{ gap: 12 }}>
                <T size={13} weight="semi">{t('reports.evCharging')}</T>
                <SplitBar
                  currency={currency}
                  rows={[
                    { label: t('reports.evHome'), minor: r.fuel.ev.home, color: PALETTE.evHome },
                    { label: t('reports.evPublic'), minor: r.fuel.ev.public, color: PALETTE.evPublic },
                    { label: t('reports.notSpecified'), minor: r.fuel.ev.unspecified, color: PALETTE.evUnspecified },
                  ]}
                />
              </View>
            ) : null}
          </View>
        )}
      </ReportSection>

      <ReportSection title={t('reports.section.servicesExpenses')} testID="report-section-services">
        {r.counts.serviceExpense === 0 ? <SectionEmpty /> : (
          <View style={{ gap: 16 }}>
            {r.services.categories.length > 0 ? (
              <View style={{ gap: 12 }}>
                <T size={13} weight="semi">{t('reports.categories')}</T>
                <SplitBar
                  currency={currency}
                  rows={r.services.categories.map((c) => ({
                    label: c.kind === 'other' ? c.label : `${c.label} · ${c.kind === 'service' ? t('reports.kindService') : t('reports.kindExpense')}`,
                    minor: c.minor,
                    color: c.kind === 'service' ? PALETTE.service : c.kind === 'expense' ? PALETTE.expense : PALETTE.evUnspecified,
                  }))}
                />
              </View>
            ) : null}
            {r.services.history.length > 0 ? (
              <View style={{ gap: 10 }}>
                <T size={13} weight="semi">{t('reports.serviceHistory')}</T>
                {r.services.history.map((h) => (
                  <View key={h.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <T size={13} weight="semi">{h.special === 'labour' ? t('reports.labour') : h.special === 'discount' ? t('reports.discount') : h.label}</T>
                      <T size={12} color={th.muted}>
                        {t('reports.visits', { count: h.visits })} · {t('reports.lastVisit', { date: formatDate(tsFromMillis(h.lastMs), settings.dateFormat) })}
                      </T>
                    </View>
                    <T size={13} weight="semi" color={h.special === 'discount' ? th.income : undefined}>
                      {h.special === 'discount' ? '−' : ''}{fmt(h.totalMinor)}
                    </T>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </ReportSection>

      {r.income !== null ? (
        <ReportSection title={t('reports.section.incomeProfit')} testID="report-section-income">
          {r.income.incomeMinor === 0 && r.income.costMinor === 0 ? <SectionEmpty /> : (() => {
            const inc = r.income!;
            return (
              <View style={{ gap: 16 }}>
                <FactRow
                  label={t('reports.netProfit')}
                  value={fmt(inc.netMinor)}
                  bold
                  valueColor={inc.netMinor < 0 ? th.danger : th.income}
                />
                {UNIT_ORDER.filter((u) => inc.profitPerKmByUnit[u as 'km' | 'mi'] !== undefined).map((u) => (
                  <FactRow
                    key={u}
                    label={t('reports.profitPerUnit', { unit: t(`units.${u}`) })}
                    value={rateText(inc.profitPerKmByUnit[u as 'km' | 'mi']!, currency, u, settings)}
                  />
                ))}
                <IncomeBars r={inc} currency={currency} />
                {inc.platforms.length > 0 ? (
                  <View style={{ gap: 12 }}>
                    <T size={13} weight="semi">{t('reports.incomeByPlatform')}</T>
                    <SplitBar
                      currency={currency}
                      rows={inc.platforms.map((p, i) => ({
                        label: p.platform,
                        minor: p.minor,
                        color: PALETTE.series[i % PALETTE.series.length],
                      }))}
                    />
                  </View>
                ) : null}
              </View>
            );
          })()}
        </ReportSection>
      ) : null}

      <ReportSection title={t('reports.section.trips')} testID="report-section-trips">
        {r.counts.trips === 0 ? <SectionEmpty /> : (
          <View style={{ gap: 10 }}>
            {UNIT_ORDER.filter((u) => r.trips.businessByUnit[u] !== undefined).map((u) => (
              <FactRow key={u} label={t('reports.business')} value={distText(r.trips.businessByUnit[u]!, u, settings)} />
            ))}
            {UNIT_ORDER.filter((u) => r.trips.personalByUnit[u] !== undefined).map((u) => (
              <FactRow key={u} label={t('reports.personal')} value={distText(r.trips.personalByUnit[u]!, u, settings)} />
            ))}
            {r.trips.reimbursementMinor > 0 ? (
              <FactRow label={t('reports.reimbursement')} value={fmt(r.trips.reimbursementMinor)} />
            ) : null}
          </View>
        )}
      </ReportSection>
    </View>
  );
}
