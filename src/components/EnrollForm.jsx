import { useState } from "react";
import { maskMobile } from "../logic/loyalty.js";

// Shown when a valid mobile number has no card yet.
export default function EnrollForm({ mobile, onEnroll, onCancel }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const result = onEnroll({ mobile, name });
    if (!result.ok) setError(result.message);
  };

  return (
    <form className="enroll" onSubmit={submit}>
      <h3>No card for {maskMobile(mobile)} yet.</h3>
      <p>Create one now. We only keep your mobile number and, if you like, your name.</p>
      <div className="field">
        <label htmlFor="enroll-name">Your name (optional)</label>
        <input
          id="enroll-name"
          autoComplete="given-name"
          maxLength={40}
          placeholder="e.g. Ana"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {error && <p className="msg msg--error" role="alert">{error}</p>}
      <div className="row">
        <button className="btn" type="submit">Create my card</button>
        <button className="btn btn--ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
