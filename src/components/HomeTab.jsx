export default function HomeTab({
  colors,
  buttonStyle,
  inputStyle,
  cardStyle,
  summaryCardStyle,
  formatCurrency,
  clearHistory,
  getBucketLabel,
  digitalBalanceTotal,
  walletTotal,
  type,
  setType,
  setCategory,
  getDefaultCategoryForType,
  setPaymentMethod,
  resetSplitRows,
  paymentMethod,
  amount,
  setAmount,
  formatAmountInput,
  isSplitMode,
  setIsSplitMode,
  currentCategories,
  category,
  date,
  setDate,
  note,
  setNote,
  splitTotal,
  parseAmountInput,
  splitMatchesMainAmount,
  splitRows,
  updateSplitRow,
  removeSplitRow,
  addSplitRow,
  editingTransactionId,
  addTransaction,
  saveEditedTransaction,
  cancelEditing,
  searchTerm,
  setSearchTerm,
  monthFilter,
  setMonthFilter,
  allMonthOptions,
  sortOption,
  setSortOption,
  renderSection,
  filteredIncomeTotal,
  incomeGroups,
  orderedIncomeMonths,
  openIncomeMonths,
  toggleIncomeMonth,
  filteredExpenseTotal,
  expenseGroups,
  orderedExpenseMonths,
  openExpenseMonths,
  toggleExpenseMonth,
  expenseBreakdown,
  accentColors,
  weeklySummaryData,
  lastPaycheckTransaction,
  spentSinceLastPaycheck,
  remainingFromLastPaycheck,
  pageTitleStyle,
  summaryGridStyle,
  actionRowStyle,
  filterGridStyle,
  denseCardGridStyle,
}) {
  return (
    <>
      <div style={{ ...actionRowStyle, marginBottom: "10px" }}>
        <button onClick={clearHistory} style={buttonStyle}>
          Clear History
        </button>
      </div>

      <h1 style={pageTitleStyle}>Budget Tracker</h1>

      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            ...summaryCardStyle,
            backgroundColor: "rgba(80, 200, 120, 0.08)",
            border: "1px solid rgba(80, 200, 120, 0.28)",
          }}
        >
          <div style={{ color: colors.subtext, fontSize: "14px" }}>
            Remaining From Last Paycheck
          </div>

          {lastPaycheckTransaction ? (
            <>
              <div style={{ fontSize: "24px", fontWeight: "bold", marginTop: "4px" }}>
                ${formatCurrency(remainingFromLastPaycheck)}
              </div>
              <div style={{ color: colors.subtext, marginTop: "6px", fontSize: "14px" }}>
                Last paycheck: ${formatCurrency(Math.abs(lastPaycheckTransaction.amount))} on{" "}
                {lastPaycheckTransaction.date}
              </div>
              <div style={{ color: colors.subtext, marginTop: "4px", fontSize: "14px" }}>
                Spent since then: ${formatCurrency(spentSinceLastPaycheck)}
              </div>
            </>
          ) : (
            <div style={{ color: colors.subtext, marginTop: "6px" }}>
              No paycheck recorded yet.
            </div>
          )}
        </div>
      </div>

      <div style={summaryGridStyle}>
        <div style={summaryCardStyle}>
          <div style={{ color: colors.subtext, fontSize: "14px" }}>
            {getBucketLabel("digital")}
          </div>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>
            ${formatCurrency(digitalBalanceTotal)}
          </div>
        </div>

        <div style={summaryCardStyle}>
          <div style={{ color: colors.subtext, fontSize: "14px" }}>
            {getBucketLabel("wallet")}
          </div>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>
            ${formatCurrency(walletTotal)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <select
          value={type}
          onChange={(e) => {
            const newType = e.target.value;
            setType(newType);
            setCategory(getDefaultCategoryForType(newType));
            if (newType !== "expense") {
              setPaymentMethod("card");
            }
            resetSplitRows(newType);
          }}
          style={inputStyle}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>

        {type === "expense" && (
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={inputStyle}
          >
            <option value="card">Card</option>
            <option value="cash">Cash</option>
          </select>
        )}

        <input
          type="text"
          inputMode="decimal"
          placeholder="Enter total amount"
          value={amount}
          onChange={(e) => setAmount(formatAmountInput(e.target.value))}
          style={inputStyle}
        />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: colors.subtext,
          }}
        >
          <input
            type="checkbox"
            checked={isSplitMode}
            onChange={(e) => {
              setIsSplitMode(e.target.checked);
              if (e.target.checked) {
                resetSplitRows(type);
              }
            }}
          />
          Split transaction
        </label>

        {!isSplitMode ? (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={inputStyle}
          >
            {currentCategories.map((cat) => (
              <option key={cat}>{cat}</option>
            ))}
          </select>
        ) : (
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Split Details</h3>
            <div style={{ color: colors.subtext, marginBottom: "10px" }}>
              Split total: ${formatCurrency(splitTotal)} / $
              {formatCurrency(Math.abs(parseAmountInput(amount)))}
            </div>

            <div
              style={{
                color: splitMatchesMainAmount ? "#9be7b4" : "#ffb3b3",
                marginBottom: "10px",
                fontWeight: "bold",
              }}
            >
              {splitMatchesMainAmount
                ? "Split matches total amount"
                : "Split must exactly match total amount"}
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              {splitRows.map((row, index) => (
                <div
                  key={row.id}
                  style={{
                    display: "grid",
                    gap: "8px",
                    padding: "10px",
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    backgroundColor: colors.card,
                  }}
                >
                  <div style={{ color: colors.subtext }}>Part {index + 1}</div>

                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Amount"
                    value={row.amount}
                    onChange={(e) =>
                      updateSplitRow(row.id, "amount", e.target.value)
                    }
                    style={inputStyle}
                  />

                  <select
                    value={row.category}
                    onChange={(e) =>
                      updateSplitRow(row.id, "category", e.target.value)
                    }
                    style={inputStyle}
                  >
                    {currentCategories.map((cat) => (
                      <option key={cat}>{cat}</option>
                    ))}
                  </select>

                  {splitRows.length > 2 && (
                    <button
                      onClick={() => removeSplitRow(row.id)}
                      style={buttonStyle}
                    >
                      Remove Part
                    </button>
                  )}
                </div>
              ))}

              <button onClick={addSplitRow} style={buttonStyle}>
                Add Split Part
              </button>
            </div>
          </div>
        )}

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={inputStyle}
        />

        <input
          type="text"
          placeholder="Add a note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={inputStyle}
        />

        {editingTransactionId === null ? (
          <button onClick={addTransaction} style={buttonStyle}>
            Add Transaction
          </button>
        ) : (
          <div style={actionRowStyle}>
            <button
              onClick={saveEditedTransaction}
              style={{ ...buttonStyle, flex: 1 }}
            >
              Save Edit
            </button>
            <button
              onClick={cancelEditing}
              style={{ ...buttonStyle, flex: 1 }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Search, Filter, Sort</h3>

        <div style={filterGridStyle}>
          <input
            type="text"
            placeholder="Search note, category, month, type, date, cash, card, refunded"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={inputStyle}
          />

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={inputStyle}
          >
            {allMonthOptions.map((month) => (
              <option key={month}>{month}</option>
            ))}
          </select>

          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            style={inputStyle}
          >
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="highest">Sort: Highest Amount</option>
            <option value="lowest">Sort: Lowest Amount</option>
          </select>
        </div>
      </div>

      {renderSection({
        title: "Income",
        total: filteredIncomeTotal,
        groups: incomeGroups,
        orderedMonths: orderedIncomeMonths,
        openMonths: openIncomeMonths,
        toggleMonth: toggleIncomeMonth,
        emptyMessage: "No income transactions match the current filters.",
      })}

      {renderSection({
        title: "Expenses",
        total: filteredExpenseTotal,
        groups: expenseGroups,
        orderedMonths: orderedExpenseMonths,
        openMonths: openExpenseMonths,
        toggleMonth: toggleExpenseMonth,
        emptyMessage: "No expense transactions match the current filters.",
      })}

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Expense Breakdown</h3>
        <div style={{ color: colors.subtext, marginBottom: "10px" }}>
          Category totals for the current expense filter.
        </div>

        {expenseBreakdown.length === 0 ? (
          <p style={{ color: colors.subtext }}>No expense data available.</p>
        ) : (
          <div style={denseCardGridStyle}>
            {expenseBreakdown.map((item, index) => (
              <div
                key={item.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  color: colors.subtext,
                  flexWrap: "wrap",
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "8px",
                  padding: "10px",
                }}
              >
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "999px",
                    display: "inline-block",
                    backgroundColor: accentColors[index % accentColors.length],
                  }}
                />
                <span style={{ color: colors.text, fontWeight: "bold" }}>
                  {item.name}
                </span>
                <span>— ${formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}