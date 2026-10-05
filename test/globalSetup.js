// Run every test in US Eastern time, where the app's users are, so date bugs that only
// show up west of UTC (like '2026-10-01' being read as Sept 30) are caught.
module.exports = () => { process.env.TZ = 'America/New_York' }
