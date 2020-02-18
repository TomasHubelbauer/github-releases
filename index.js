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
  let counter = 0;
  for await (const repository of repositories) {
    counter++;

    /** @type {{ id: number; name: string; url: string; }[]} */
    const releases = [];

    // Take only the first page of the latest releases to avoid fetching them all
    // Do not worry about missing releases - only if a the repo released 30+ in a day
    try {
      for await (const release of github.getReposOwnerRepoReleases(repository.full_name, { token, pageLimit: 1, onPageChange: true, onLimitChange: true })) {
        releases.push({ id: release.id, name: `${release.tag_name}${release.name ? ' ' + release.name : ''}`, url: release.html_url });
      }
    }
    catch (error) {
      // Handle things like DMCA etc. causing the call to error out
      continue;
    }

    console.log(`${counter}/${count}: ${repository.full_name} - ${releases.length} releases`);
    const path = `data/${repository.full_name}.json`;

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
      emailLines.push(`<p><b>${repository.full_name}</b></p>`);
      emailLines.push('<ul>');
      for (const release of newRepoReleases) {
        emailLines.push(`<li><a href="${release.url}">${release.name}</a></li>`);
      }

      emailLines.push('</ul>');
    }

    await fs.ensureFile(path);
    await fs.writeJson(path, releases, { spaces: 2 });
  }

  await fs.writeJson('count.json', counter);

  if (emailLines.length > 0 && email) {
    const repositories = emailLines.filter(l => l.startsWith('<p><b>')).length;
    const releases = emailLines.filter(l => l.startsWith('<li>')).length;
    await email(
      headers('GitHub Releases', `${releases} new releases across ${repositories} repositories`),
      `<p>There are ${releases} new releases across ${repositories} repositories:</p>`,
      ...emailLines
    );
  }
};

module.exports = module.exports();
