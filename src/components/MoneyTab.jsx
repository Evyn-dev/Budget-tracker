export default function MoneyTab({
  colors,
  inputStyle,
  buttonStyle,
  cardStyle,
  summaryCardStyle,
  formatCurrency,
  totalIncome,
  totalExpenses,
  moneyTotalsStartDate,
  setMoneyTotalsStartDate,
  getBucketLabel,
  digitalBalanceTotal,
  walletTotal,
  savingsTotal,
  spendableBalance,
  totalBalanceIncludingSavings,
  bucketLabels,
  setBucketLabels,
  DEFAULT_BUCKET_LABELS,
  transferFrom,
  setTransferFrom,
  transferTo,
  setTransferTo,
  transferAmount,
  setTransferAmount,
  transferNote,
  setTransferNote,
  formatAmountInput,
  addBucketTransfer,
  orderedBucketTransfers,
  deleteBucketTransfer,
  pageTitleStyle,
  summaryGridStyle,
  actionRowStyle,
}) {
  return (
    <>
      <h1 style={pageTitleStyle}>Money Buckets</h1>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Income / Expense Totals Filter</h3>

        <div style={actionRowStyle}>
          <input
            type="date"
            value={moneyTotalsStartDate}
            onChange={(e) => setMoneyTotalsStartDate(e.target.value)}
            style={inputStyle}
          />

          {moneyTotalsStartDate && (
            <button
              onClick={() => setMoneyTotalsStartDate("")}
              style={buttonStyle}
            >
              Clear Date Filter
            </button>
          )}

          <div style={{ color: colors.subtext, fontSize: "14px" }}>
            {moneyTotalsStartDate
              ? `Showing income and expenses from ${moneyTotalsStartDate} onward.`
              : "Showing all income and expenses across all time."}
          </div>
        </div>
      </div>

      <div style={summaryGridStyle}>
        <div
          style={{
            ...summaryCardStyle,
            backgroundColor: "rgba(80, 200, 120, 0.08)",
            border: "1px solid rgba(80, 200, 120, 0.25)",
          }}
        >
          <div style={{ color: colors.subtext, fontSize: "14px" }}>
            All Time Income
          </div>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>
            ${formatCurrency(totalIncome)}
          </div>
        </div>

        <div
          style={{
            ...summaryCardStyle,
            backgroundColor: "rgba(255, 107, 107, 0.08)",
            border: "1px solid rgba(255, 107, 107, 0.25)",
          }}
        >
          <div style={{ color: colors.subtext, fontSize: "14px" }}>
            All Time Expenses
          </div>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>
            ${formatCurrency(totalExpenses)}
          </div>
        </div>

        <div style={summaryCardStyle}>
          <div style={{ color: colors.subtext, fontSize: "14px" }}>
            {getBucketLabel("savings")}
          </div>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>
            ${formatCurrency(savingsTotal)}
          </div>
        </div>

        <div style={summaryCardStyle}>
          <div style={{ color: colors.subtext, fontSize: "14px" }}>
            Spendable Balance
          </div>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>
            ${formatCurrency(spendableBalance)}
          </div>
        </div>

        <div style={summaryCardStyle}>
          <div style={{ color: colors.subtext, fontSize: "14px" }}>
            Total Balance Including Savings
          </div>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>
            ${formatCurrency(totalBalanceIncludingSavings)}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Rename Buckets</h3>

        <div style={{ display: "grid", gap: "10px" }}>
          <input
            type="text"
            value={bucketLabels.digital}
            onChange={(e) =>
              setBucketLabels((prev) => ({
                ...prev,
                digital: e.target.value || DEFAULT_BUCKET_LABELS.digital,
              }))
            }
            placeholder="Digital bucket name"
            style={inputStyle}
          />

          <input
            type="text"
            value={bucketLabels.wallet}
            onChange={(e) =>
              setBucketLabels((prev) => ({
                ...prev,
                wallet: e.target.value || DEFAULT_BUCKET_LABELS.wallet,
              }))
            }
            placeholder="Wallet bucket name"
            style={inputStyle}
          />

          <input
            type="text"
            value={bucketLabels.savings}
            onChange={(e) =>
              setBucketLabels((prev) => ({
                ...prev,
                savings: e.target.value || DEFAULT_BUCKET_LABELS.savings,
              }))
            }
            placeholder="Savings bucket name"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Move Money</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <select
            value={transferFrom}
            onChange={(e) => {
              const nextFrom = e.target.value;
              setTransferFrom(nextFrom);
              if (nextFrom === transferTo) {
                const fallback =
                  ["digital", "wallet", "savings"].find(
                    (bucket) => bucket !== nextFrom
                  ) || "savings";
                setTransferTo(fallback);
              }
            }}
            style={inputStyle}
          >
            {["digital", "wallet", "savings"].map((bucket) => (
              <option key={bucket} value={bucket}>
                From: {getBucketLabel(bucket)}
              </option>
            ))}
          </select>

          <select
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            style={inputStyle}
          >
            {["digital", "wallet", "savings"]
              .filter((bucket) => bucket !== transferFrom)
              .map((bucket) => (
                <option key={bucket} value={bucket}>
                  To: {getBucketLabel(bucket)}
                </option>
              ))}
          </select>

          <input
            type="text"
            inputMode="decimal"
            placeholder="Enter amount"
            value={transferAmount}
            onChange={(e) => setTransferAmount(formatAmountInput(e.target.value))}
            style={inputStyle}
          />

          <input
            type="text"
            placeholder="Add a note"
            value={transferNote}
            onChange={(e) => setTransferNote(e.target.value)}
            style={inputStyle}
          />

          <button onClick={addBucketTransfer} style={buttonStyle}>
            Save Transfer
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>How It Works</h3>
        <div style={{ color: colors.subtext, display: "grid", gap: "6px" }}>
          <div>
            {getBucketLabel("digital")}: regular money not currently in{" "}
            {getBucketLabel("wallet")} or {getBucketLabel("savings")}.
          </div>
          <div>
            {getBucketLabel("wallet")}: still spendable, just set aside as a separate
            cash pocket.
          </div>
          <div>{getBucketLabel("savings")}: not counted as spendable.</div>
          <div>
            Spendable Balance = {getBucketLabel("digital")} +{" "}
            {getBucketLabel("wallet")}.
          </div>
          <div>
            Total Balance Including Savings = {getBucketLabel("digital")} +{" "}
            {getBucketLabel("wallet")} + {getBucketLabel("savings")}.
          </div>
          <div>Card expenses come out of {getBucketLabel("digital")}.</div>
          <div>Cash expenses come out of {getBucketLabel("wallet")}.</div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Transfer History</h3>

        {orderedBucketTransfers.length === 0 ? (
          <p style={{ color: colors.subtext }}>No transfers yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {orderedBucketTransfers.map((transfer) => {
              const bgColor =
                transfer.to === "savings" || transfer.from === "savings"
                  ? colors.savingsBg
                  : transfer.to === "wallet" || transfer.from === "wallet"
                    ? colors.walletBg
                    : colors.card;

              const borderColor =
                transfer.to === "savings" || transfer.from === "savings"
                  ? colors.savingsBorder
                  : transfer.to === "wallet" || transfer.from === "wallet"
                    ? colors.walletBorder
                    : colors.border;

              return (
                <div
                  key={transfer.id}
                  style={{
                    backgroundColor: bgColor,
                    border: `1px solid ${borderColor}`,
                    borderRadius: "8px",
                    padding: "12px",
                  }}
                >
                  <div style={{ color: colors.text, fontWeight: "bold" }}>
                    {getBucketLabel(transfer.from)} → {getBucketLabel(transfer.to)}: $
                    {formatCurrency(transfer.amount)}
                  </div>
                  <div style={{ color: colors.subtext, marginTop: "4px" }}>
                    Date: {transfer.date}
                  </div>
                  {transfer.note && (
                    <div style={{ color: colors.subtext, marginTop: "4px" }}>
                      Note: {transfer.note}
                    </div>
                  )}
                  <div style={{ marginTop: "10px" }}>
                    <button
                      onClick={() => deleteBucketTransfer(transfer.id)}
                      style={buttonStyle}
                    >
                      Delete
                    </button>
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