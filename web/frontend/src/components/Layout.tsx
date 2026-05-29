import { Link, useNavigate } from "react-router-dom";
import { useLogout, useMe } from "../api/hooks";
import Avatar from "./Avatar";
import Icon from "./Icon";

export default function AppTopbar() {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="bl-topbar">
      <Link to="/" className="wordmark">
        <img src="/logo.png" className="brand-mark" alt="" />
        Company Brain
      </Link>
      <div className="spacer" />
      {user && (
        <>
          <span className="ws-name dim">
            workspace · <b style={{ color: "var(--text-2)" }}>{user.github_username}</b>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/settings")}>
            <Icon name="bell" size={13} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => logout.mutate()}>
            <Icon name="logout" size={13} />
          </button>
          <Avatar name={user.github_username} />
        </>
      )}
    </div>
  );
}
