const github = require('github-api');
const fs = require('fs-extra');
let email;
let headers;
try {
  email = require('../self-email');
  headers = require('../self-email/headers');
}
catch (error) {
  // Ignore the mailer missing on this system
}

// Crash the process on an unhandled promise rejection
process.on('unhandledRejection', error => { throw error; });

module.exports = async function () {
  const token = process.argv[2] || process.env.GITHUB_TOKEN;
  const repositories = token
    ? github.getUserStarred({ token })
    : github.getUsersUserStarred('TomasHubelbauer')
    ;

  const emailLines = [];
  for await (const repository of repositories) {
    /** @type {{ id: number; name: string; url: string; }[]} */
    const releases = [];
    for await (const release of github.getReposOwnerRepoReleases(repository.full_name, { token })) {
      releases.push({ id: release.id, name: release.name, url: release.html_url });
      
      // Take the top 20 new releases and ignore older releases so that we don't fetch all releases for all projects
      // The releases are ordered newest to oldest, so we do not need to worry about missing a new release this way
      // We will miss releases if a project has more than 20 releases in a single day, but that's a worthwhile tradeoff
      if (releases.length === 20) {
        break;
      }
    }

    console.log(repository.full_name, releases.length, 'releases');
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

  if (emailLines.length > 0 && email) {
    const repositories = emailLines.filter(l => l.startsWith('<p><b>')).length;
    const releases = emailLines.filter(l => l.startsWith('<li>')).length;
    await email(
      headers('GitHub Releases', `${releases} new releases across ${repositories} repositories`),
      `<p>There are ${releases} across ${repositories} repositories:</p>`,
      ...emailLines
    );
  }
};

module.exports = module.exports();
