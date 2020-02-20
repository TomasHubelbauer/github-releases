const github = require('github-api');
const fs = require('fs-extra');
const email = require('../self-email');
const headers = require('../self-email/headers');

module.exports = async function () {
  const token = process.argv[2] || process.env.GITHUB_TOKEN;
  const repositories = token
    ? github.getUserStarred({ token })
    : github.getUsersUserStarred('TomasHubelbauer')
    ;

  let count = '?';
  try {
    count = await fs.readJson('count.json');
  }
  catch (error) {
    // Ignore no count stored yet
  }

  const emailLines = [];
  let repositoryCount = 0;
  let releaseCount = 0;
  let counter = 0;
  for await (const { starred_at, repo } of repositories) {
    const starredAtDate = new Date(starred_at);
    counter++;

    /** @type {{ id: number; name: string; url: string; }[]} */
    const releases = [];

    // Take only the first page of the latest releases to avoid fetching them all
    // Do not worry about missing releases - only if a the repo released 30+ in a day
    try {
      for await (const release of github.getReposOwnerRepoReleases(repo.full_name, { token, pageLimit: 1, onPageChange: true, onLimitChange: true })) {
        const publishedAtDate = new Date(release.published_at);

        // Ignore releases made prior to starring the repository to avoid a barrage of old releases on the next run after starring
        if (publishedAtDate < starredAtDate) {
          continue;
        }

        releases.push({ id: release.id, name: `${release.tag_name}${release.name ? ' ' + release.name : ''}`, url: release.html_url });
      }
    }
    catch (error) {
      // Handle things like DMCA etc. causing the call to error out
      continue;
    }

    console.log(`${counter}/${count}: ${repo.full_name} - ${releases.length} releases`);
    const path = `data/${repo.full_name}.json`;

    /** @type {{ id: number; name: string; url: string; }[]} */
    let knownReleases = [];
    try {
      knownReleases = await fs.readJson(path);
    }
    catch (error) {
      // Ignore no releases being known yet
    }

    const newRepoReleases = releases.filter(r => !knownReleases.find(r2 => r2.id === r.id));
    if (newRepoReleases.length > 0) {
      repositoryCount++;

      emailLines.push(`<p><a href="${repo.html_url}"><b>${repo.full_name}</b> (${newRepoReleases.length})</a></p>`);
      if (repo.description) {
        emailLines.push(`<p>${repo.description}</p>`);
      }

      // Note that this only reports *Watch* and not *Watch Releases*
      // TODO: Await GitHub support reply about API for "Watch Releases" subscriptions
      const subscription = await github.getReposOwnerRepoSubscription(repo.full_name, token);
      if (subscription.subscribed) {
        emailLines.push(`<p><b>You are also watching this repository on GitHub.</b></p>`);
      }

      emailLines.push('<ul>');
      for (const release of newRepoReleases) {
        releaseCount++;

        emailLines.push('<li>');
        emailLines.push(`<a href="${release.url}">${release.name}</a>`);
        emailLines.push('</li>');
      }

      emailLines.push('</ul>');
    }

    await fs.ensureFile(path);
    await fs.writeJson(path, releases, { spaces: 2 });
  }

  await fs.writeJson('count.json', counter);

  if (emailLines.length > 0 && email) {
    await email(
      headers('GitHub Releases', `${releaseCount} new releases across ${repositoryCount} repositories`),
      `<p>There are ${releaseCount} new releases across ${repositoryCount} repositories:</p>`,
      ...emailLines,
      'Thank you'
    );
  }
};

module.exports = module.exports();
