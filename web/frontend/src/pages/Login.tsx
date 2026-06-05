import Icon from "../components/Icon";

export default function Login() {
  return (
    <div className="signin-shell">
      <div className="signin-card">
        <img src="/logo.png" className="brand-mark-lg" alt="Company Brain" />
        <h1>Company Brain</h1>
        <div className="tagline">
          Author a brain for one service at your company.
          Walk a domain expert through it. Ship it as a folder.
        </div>
        <a href="/api/auth/github/start" className="gh-btn">
          <Icon name="github" size={18} color="#fff" />
          Sign in with GitHub
        </a>
        <div className="terms">
          By signing in you agree to our <a>terms</a> and <a>privacy notice</a>.
        </div>
      </div>
    </div>
  );
}
