# GitHub Releases

Monitors GitHub Releases of projects I star on GitHub and sends a single daily
digest email. A more humane alternative to Watch Releases, especially in cases
where someone discovers GitHub Releases and decides to bulk-cut releases for
each release of their project to date using the GitHub API, resulting in a
barrage of emails hitting your inbox.

## Running

`node . {token}`

`token` should be provided through the command line argument or through the
`GITHUB_TOKEN` environment variable. If not provided, public API rate limits
apply.

## To-Do

### Use the `github-api` project of mine to hook this up
