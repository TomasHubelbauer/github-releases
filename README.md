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

### Consider scraping my repos watched for releases off GitHub until API'd

### Encode the email properly so that emoji shows up correctly

### Convert shortcodes in the repository descriptions to emoji

### Update the email copy to say the checked period

The range from the value of `stamp.utc` til now is the check range. In the
email body, say "X releases across Y repositories since D" where D is the date.
Since it is virtually always going to be either daily or hourly, add relative
time formatting (yesterday at X, an hour ago, X hours ago, ...).

### Parallelize the network calls

Several of my other GitHub API based repositories already use this, so I can
quickly adapt this: call the GitHub API for releases in bulks, where the
network calls are parallel and so is the processing, bringing the overall
run time down. This introduces a new parameter: the limit of maximal permitted
concurrency. For now set at 10 or something, or maybe elect to run a study like
one or two of my other repos do: set the level of parallelism at the current
day of month number and store the times for each day number, in time revealing
the average sweep spot where the given level of concurrency provides the optimal
speed up.

Also it might be worth-while to pull out the bulking logic and use it as a
package in this and other repos where I've implemented the bulking. But it might
be too trivial to be worth it.

### Consider limit-saving strategies

**Pull all the repositories first and look at ones with known releases first**

This will maximize the opportunity to find new releases as repositories which
already have releases are more likely to have new ones than the ones that don't
have any releases yet.

**Group the repositories into buckets and run different buckets on each run**

Maybe group by the first name or something because as it stands this might blow
all the way through even the authenticated rate limits and if not, eat up a
significant chunk which chokes subsequent GitHub API users on the IP.

**Have a batch size limit and process repositories in the oldest to newest**

Keep the information about when was the last time a repo was checked. Scan the
repos on each run and pick a handful (configured by the maximum batch size) and
do those updating their stamps. On the next run, do another back based on the
dates again. This will allow now using up all of the available rate limit (just
the configured bunch) freeing up the rest to other scripts. It could be run
hourly and always use say max 50 % of the hour's rate.
