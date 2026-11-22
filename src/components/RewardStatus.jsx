const when = (iso) => new Date(iso).toLocaleDateString("en-PH", { dateStyle: "medium" });

export default function RewardStatus({ summary }) {
  const { status, rewards, waitingRewards } = summary;
  let banner = null;
  if (status.complete && waitingRewards > 0) {
    banner = (
      <div className="reward reward--earned" role="status">
        <h3>Card complete! You’ve earned a free drink.</h3>
        <p>Reward status: <strong>Ready to claim</strong>. Show this card to the staff. Your next purchase starts a new card.</p>
      </div>
    );
  } else if (waitingRewards > 0) {
    banner = (
      <div className="reward reward--earned" role="status">
        <h3>A free drink is waiting for you.</h3>
        <p>Reward status: <strong>Ready to claim</strong>. Show this card to the staff.</p>
      </div>
    );
  } else if (status.complete) {
    banner = (
      <div className="reward" role="status">
        <h3>Card complete!</h3>
        <p>Your free drink has been claimed. Your next purchase starts a new card.</p>
      </div>
    );
  }

  return (
    <>
      {banner}
      {rewards.length > 0 && (
        <div className="subsection">
          <h3>Free drinks</h3>
          <ul className="plain-list">
            {rewards.map((r) => (
              <li key={r.id}>
                Card {r.card_number}: {r.reward_status === "redeemed" ? `claimed on ${when(r.redeemed_at)}` : "ready to claim"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
