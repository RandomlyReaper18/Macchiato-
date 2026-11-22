import StaffCodePanel from "./StaffCodePanel";
import StaffLogin from "./StaffLogin";

// Decides what the Staff area shows: nothing sensitive is rendered until the
// database confirms the signed-in user is on the staff list.
export default function StaffSection({ staff, api }) {
  if (staff.status === "loading") {
    return <div className="paper paper--ticket"><p className="muted">Checking staff sign-in…</p></div>;
  }
  if (staff.status === "not_staff") {
    return (
      <div className="paper paper--ticket">
        <h2>Not a staff account</h2>
        <p>{staff.email} is signed in but is not on the staff list, so it can't issue codes. Ask the owner to add it.</p>
        <button className="btn btn--ghost" type="button" onClick={staff.signOut}>Sign out</button>
      </div>
    );
  }
  if (staff.status !== "staff") return <StaffLogin onSignIn={staff.signIn} problem={staff.problem} />;
  return <StaffCodePanel api={api} email={staff.email} onSignOut={staff.signOut} />;
}
