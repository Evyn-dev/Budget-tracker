export default function RecapsTab({
  colors,
  cardStyle,
  formatCurrency,
  recapWeeklyData,
  monthlyRecapData,
  pageTitleStyle,
  denseCardGridStyle,
}) {
  return (
    <>
      <h1 style={pageTitleStyle}>Recaps</h1>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Weekly Recap</h3>
        <div style={{ color: colors.subtext, marginBottom: "10px" }}>
          Based on all transactions from the last 7 days.
        </div>

        {recapWeeklyData.length === 0 ? (
          <p style={{ color: colors.subtext }}>No weekly data available.</p>
        ) : (
          <div style={denseCardGridStyle}>
            {recapWeeklyData.map((day) => {
              const net = day.income - day.expense;

              return (
                <div
                  key={day.date}
                  style={{
                    backgroundColor: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    padding: "12px",
                  }}
                >
                  <div style={{ color: colors.text, fontWeight: "bold" }}>
                    {day.label}
                  </div>
                  <div style={{ color: colors.subtext, marginTop: "4px" }}>
                    Transactions: {day.count}
                  </div>
                  <div style={{ color: colors.subtext }}>
                    Income: ${formatCurrency(day.income)}
                  </div>
                  <div style={{ color: colors.subtext }}>
                    Expenses: ${formatCurrency(day.expense)}
                  </div>
                  <div
                    style={{
                      color: net >= 0 ? "#9be7b4" : "#ff9b9b",
                      marginTop: "4px",
                      fontWeight: "bold",
                    }}
                  >
                    Net: {net >= 0 ? "+" : "-"}${formatCurrency(Math.abs(net))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Monthly Recap</h3>
        <div style={{ color: colors.subtext, marginBottom: "10px" }}>
          Monthly income, expenses, and net totals.
        </div>

        {monthlyRecapData.length === 0 ? (
          <p style={{ color: colors.subtext }}>No monthly data available.</p>
        ) : (
          <div style={denseCardGridStyle}>
            {monthlyRecapData.map((month) => {
              const net = month.income - month.expense;

              return (
                <div
                  key={month.monthKey}
                  style={{
                    backgroundColor: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    padding: "12px",
                  }}
                >
                  <div style={{ color: colors.text, fontWeight: "bold" }}>
                    {month.monthKey}
                  </div>
                  <div style={{ color: colors.subtext, marginTop: "4px" }}>
                    Transactions: {month.count}
                  </div>
                  <div style={{ color: colors.subtext }}>
                    Income: ${formatCurrency(month.income)}
                  </div>
                  <div style={{ color: colors.subtext }}>
                    Expenses: ${formatCurrency(month.expense)}
                  </div>
                  <div
                    style={{
                      color: net >= 0 ? "#9be7b4" : "#ff9b9b",
                      marginTop: "4px",
                      fontWeight: "bold",
                    }}
                  >
                    Net: {net >= 0 ? "+" : "-"}${formatCurrency(Math.abs(net))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}