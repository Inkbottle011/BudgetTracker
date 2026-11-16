// @ts-check
// The Budget Tracker docs site. The pages are Markdown files in the repo's docs/ folder
// (one copy of each, readable on GitHub too); this folder only holds the site's setup.
import { themes as prismThemes } from 'prism-react-renderer'

const REPO = 'https://github.com/Inkbottle011/BudgetTracker'
const APP = 'https://managemymulah.netlify.app'

/** @type {import('@docusaurus/types').Config} */
const config = {
    title: 'Budget Tracker',
    tagline: 'Plan a budget, track every transaction, and see how the month is going.',
    favicon: 'img/favicon.png',

    // Published by .github/workflows/deploy-docs.yml to GitHub Pages
    url: 'https://inkbottle011.github.io',
    baseUrl: '/BudgetTracker/',
    organizationName: 'Inkbottle011',
    projectName: 'BudgetTracker',
    trailingSlash: false,

    // A link to a page that doesn't exist stops the build, so broken links never go live
    onBrokenLinks: 'throw',
    markdown: { hooks: { onBrokenMarkdownLinks: 'throw' } },

    i18n: { defaultLocale: 'en', locales: ['en'] },

    presets: [
        [
            'classic',
            /** @type {import('@docusaurus/preset-classic').Options} */
            ({
                docs: {
                    path: '../docs',
                    routeBasePath: 'docs',
                    sidebarPath: './sidebars.js',
                    editUrl: `${REPO}/edit/master/docs/`,
                    showLastUpdateTime: false,
                },
                blog: false,
                theme: { customCss: './src/css/custom.css' },
            }),
        ],
    ],

    themeConfig:
        /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
        ({
            image: 'img/logo.png',
            colorMode: { respectPrefersColorScheme: true },
            navbar: {
                title: 'Budget Tracker',
                logo: { alt: '', src: 'img/logo.png' },
                items: [
                    { type: 'docSidebar', sidebarId: 'guide', position: 'left', label: 'User guide' },
                    { type: 'docSidebar', sidebarId: 'developers', position: 'left', label: 'Developers' },
                    { href: APP, label: 'Open the app', position: 'right' },
                    { href: REPO, label: 'GitHub', position: 'right' },
                ],
            },
            footer: {
                style: 'dark',
                links: [
                    {
                        title: 'Using the app',
                        items: [
                            { label: 'Getting started', to: '/docs/guide/getting-started' },
                            { label: 'Linking a bank', to: '/docs/guide/linking-a-bank' },
                            { label: 'Questions and problems', to: '/docs/guide/troubleshooting' },
                        ],
                    },
                    {
                        title: 'Working on it',
                        items: [
                            { label: 'How it works', to: '/docs/developers/architecture' },
                            { label: 'Set up your own copy', to: '/docs/developers/setup' },
                            { label: 'Testing', to: '/docs/developers/testing' },
                        ],
                    },
                    {
                        title: 'More',
                        items: [
                            { label: 'Open the app', href: APP },
                            { label: 'GitHub', href: REPO },
                        ],
                    },
                ],
            },
            prism: { theme: prismThemes.github, darkTheme: prismThemes.dracula, additionalLanguages: ['bash', 'powershell', 'sql'] },
        }),
}

export default config
