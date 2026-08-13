# Security policy

This project is a production-oriented bridge and does not currently operate a
public security advisory process. Please do not disclose a suspected
vulnerability in a public issue before maintainers have had a chance to assess
it.

For now, report it privately to the repository owner with a minimal
reproduction, affected package version, TanStack Router version, and whether it
requires a malicious remote route tree or a compromised host.

The published package must remain transport-agnostic: it executes only the
route tree returned by host code. Hosts are responsible for the trust boundary
around Module Federation remotes, dynamic imports, manifests, and integrity
verification.
