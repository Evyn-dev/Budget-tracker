export default function SubscriptionsTab({
  colors,
  inputStyle,
  buttonStyle,
  cardStyle,
  summaryCardStyle,
  formatCurrency,
  totalSubscriptionAmount,
  subscriptions,
  subscriptionName,
  setSubscriptionName,
  subscriptionAmount,
  setSubscriptionAmount,
  formatAmountInput,
  subscriptionDueDate,
  setSubscriptionDueDate,
  subscriptionNote,
  setSubscriptionNote,
  subscriptionFrequency,
  setSubscriptionFrequency,
  subscriptionCustomIntervalDays,
  setSubscriptionCustomIntervalDays,
  addSubscription,
  upcomingSubscriptions,
  deleteSubscription,
  pageTitleStyle,
  summaryGridStyle,
}) {
  return (
    <>
      <h1 style={pageTitleStyle}>Subscriptions</h1>

      <div style={summaryGridStyle}>
        <div style={summaryCardStyle}>
          <div style={{ color: colors.subtext }}>Total Recurring</div>
          <div style={{ fontSize: "22px", fontWeight: "bold" }}>
            ${formatCurrency(totalSubscriptionAmount)}
          </div>
        </div>

        <div style={summaryCardStyle}>
          <div style={{ color: colors.subtext }}>Tracked</div>
          <div style={{ fontSize: "22px", fontWeight: "bold" }}>
            {subscriptions.length}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3>Add Subscription</h3>

        <div style={{ display: "grid", gap: "10px" }}>
          <input
            placeholder="Name"
            value={subscriptionName}
            onChange={(e) => setSubscriptionName(e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="Amount"
            value={subscriptionAmount}
            onChange={(e) =>
              setSubscriptionAmount(formatAmountInput(e.target.value))
            }
            style={inputStyle}
          />

          <input
            type="date"
            value={subscriptionDueDate}
            onChange={(e) => setSubscriptionDueDate(e.target.value)}
            style={{
              ...inputStyle,
              width: "100%",
              minWidth: 0
            }}
          />

          {/* DROPDOWN */}
          <select
            value={subscriptionFrequency}
            onChange={(e) => setSubscriptionFrequency(e.target.value)}
            style={inputStyle}
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom</option>
          </select>

          {subscriptionFrequency === "custom" && (
            <input
              type="number"
              placeholder="Days between charges"
              value={subscriptionCustomIntervalDays}
              onChange={(e) =>
                setSubscriptionCustomIntervalDays(e.target.value)
              }
              style={inputStyle}
            />
          )}

          <input
            placeholder="Note"
            value={subscriptionNote}
            onChange={(e) => setSubscriptionNote(e.target.value)}
            style={inputStyle}
          />

          <button onClick={addSubscription} style={buttonStyle}>
            Add
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3>Upcoming</h3>

        {upcomingSubscriptions.length === 0 ? (
          <p style={{ color: colors.subtext }}>No subscriptions yet.</p>
        ) : (
          upcomingSubscriptions.map((sub) => (
            <div
              key={sub.id}
              style={{
                border: `1px solid ${sub.statusBorderColor}`,
                backgroundColor: sub.statusBackgroundColor,
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "10px",
              }}
            >
              <div style={{ fontWeight: "bold" }}>
                {sub.name} — ${formatCurrency(sub.amount)}
              </div>

              <div style={{ color: colors.subtext }}>
                Due: {sub.dueDate}
              </div>

              <div style={{ color: sub.statusAccent, fontWeight: "bold" }}>
                {sub.statusLabel}
              </div>

              <div style={{ color: colors.subtext, fontSize: "14px" }}>
                {sub.frequencyLabel}
              </div>

              <button
                onClick={() => deleteSubscription(sub.id)}
                style={{ ...buttonStyle, marginTop: "8px" }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}