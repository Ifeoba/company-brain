import { Link, useNavigate } from "react-router-dom";
import { useLogout, useMe } from "../api/hooks";

const AVATAR_COLORS = [
  "#7cf29c", "#f2c47c", "#7cb8f2", "#f27c9a",
  "#c47cf2", "#f2e57c", "#7cf2e5", "#f29c7c",
];

function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f0f] flex flex-col">
      {/* Top bar */}
      <header className="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center px-5 gap-4 shrink-0">
        <Link to="/" className="text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Company Brain
        </Link>
        <div className="flex-1" />
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">{user.github_username}</span>
            <button
              onClick={() => navigate("/settings")}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Settings
            </button>
            <button
              onClick={() => logout.mutate()}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Sign out
            </button>
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full" />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: colorFromString(user.github_username), color: "#111" }}
              >
                {user.github_username[0].toUpperCase()}
              </div>
            )}
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
