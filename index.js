const github = require('github-api');
const fs = require('fs-extra');
const path = require('path');

module.exports = async function () {
  const token = process.argv[2] || process.env.GITHUB_TOKEN;
  const repositories = token
    ? github.getUserStarred({ token })
    : github.getUsersUserStarred('TomasHubelbauer')
    ;

  const countJsonFilePath = path.join(__dirname, 'count.json');
  const stampUtcFilePath = path.join(__dirname, 'stamp.utc');

  // Load the approximate count of the releases for progress display purposes
  let count = '?';
  try {
    count = await fs.readJson(countJsonFilePath);
  }
  catch (error) {
    // Ignore no count stored yet
  }

  // Calculate the cut-off date, all releases past this date are considered seen
  let stamp = new Date();
  try {
    // Use the actual last report date if available
    stamp = new Date(await fs.readFile(stampUtcFilePath, { encoding: 'ascii' }));
  }
  catch (error) {
    // Ignore no stamp stored yet
  }

  const email = [];
  let repositoryCount = 0;
  let releaseCount = 0;
  let counter = 0;
  for await (const { repo } of repositories) {
    counter++;

    /** @type {{ id: number; tag: string; name: string; url: string; }[]} */
    const releases = [];

    // Take only the first page of the latest releases to avoid fetching them all
    // Do not worry about missing releases - only if a the repo released 100+ in a day
    try {
      for await (const release of github.getReposOwnerRepoReleases(repo.full_name, { token, pageLimit: 1, onPageChange: true, onLimitChange: true })) {
        const publishedAtDate = new Date(release.published_at);

        // Ignore releases made prior the last report (or current instant) to avoid barrages of old releases
        if (publishedAtDate < stamp) {
          continue;
        }

        let name = release.name || '';
        const tag = release.tag_name;
        if (name === tag || 'v' + name === tag) {
          name = '';
        }

        releases.push({ id: release.id, tag, name, url: release.html_url });
      }
    }
    catch (error) {
      // Handle things like DMCA etc. causing the call to error out
      continue;
    }

    // Take the larger of the counter and the approximate count to account for more starred repos since the approximation
    console.log(`${counter}/${Math.max(count, counter)}: ${repo.full_name} - ${releases.length} new releases since ${stamp.toISOString()}`);

    if (releases.length > 0) {
      repositoryCount++;

      email.push(`<p><a href="${repo.html_url}"><b>${repo.full_name}</b> (${releases.length})</a></p>`);
      if (repo.description) {
        email.push(`<p>${repo.description}</p>`);
      }

      // Note that this only reports *Watch* and not *Watch Releases*
      // TODO: Await GitHub API support for "Watch Releases" subscriptions
      const subscription = await github.getReposOwnerRepoSubscription(repo.full_name, token);
      if (subscription.subscribed) {
        email.push(`<p><b>You are also watching this repository on GitHub.</b></p>`);
      }
      for (const release of releases) {
        releaseCount++;

        email.push('<details>');
        email.push('<summary>');
        email.push(`<a href="${release.url}">`);
        email.push(`<code>${release.tag}</code>`);
        if (release.name) {
          email.push(' ' + release.name);
        }

        email.push('</a>');
        email.push('</summary>');
        email.push(release.body);
        email.push('</details>');
      }
    }

    await fs.writeFile(stampUtcFilePath, new Date());
  }

  await fs.writeJson(countJsonFilePath, counter);

  return [
    `<p>There are ${releaseCount} new releases across ${repositoryCount} repositories:</p>`,
    ...email,
  ];
};

if (process.cwd() === __dirname) {
  module.exports().then(console.log);
}
