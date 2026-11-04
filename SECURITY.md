# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately. If this project is hosted on GitHub and private vulnerability reporting is enabled, use the repository's **Security → Advisories** page. Otherwise, contact the repository maintainer through a private channel. Do not publish exploit details in a public issue before a fix is available.

Include the affected version or commit, the runtime and operating system, steps to reproduce, and the likely impact. Please avoid including real secrets or personal data in the report. The maintainers will acknowledge reports as soon as practical and coordinate a fix and disclosure with the reporter.

## Supported runtime and security updates

The server requires Node.js **24.22.2 or newer in the Node.js 24 LTS line**. Use a currently patched 24.x release and keep it updated; the [October 21, 2026 Node.js security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) fixed multiple high-severity issues, including a Brotli decoder flaw that could cause memory corruption when an application decompresses attacker-controlled Brotli data. Node.js 24.22.2 was released on October 28, 2026; see the [official release notes](https://nodejs.org/en/blog/release/v24.22.2). The project does not call Node's Brotli decoder directly, but it still requires a patched Node runtime.

The October 20, 2026 PHP notice led to critical PHP fixes in PHP 8.5.12, 8.4.27, 8.3.36, and 8.2.35 on October 21 ([PHP security advisory](https://www.php.net/archive/2026.php#2026-10-21-5)). This project has no PHP runtime or PHP dependencies, so those PHP vulnerabilities do not apply to this codebase. If PHP is added to the deployment stack separately, keep that runtime on a patched supported release.

Keep `package-lock.json` committed and run `npm audit` when dependencies change. Apply available security updates and review the resulting lockfile before release.

## Deployment guidance

- Serve production traffic over HTTPS/WSS through a maintained TLS terminator.
- Keep secrets out of source control, client-side bundles, logs, and issue reports.
- Restrict network access to the game server to the ports and origins required by the deployment.
- Keep the operating system, Node.js runtime, npm dependencies, and reverse proxy patched.
- Treat public game room codes as join credentials and avoid logging them unnecessarily.
