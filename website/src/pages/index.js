import Link from '@docusaurus/Link'
import Layout from '@theme/Layout'
import styles from './index.module.css'

const FEATURES = [
    {
        title: 'See how the month is going',
        text: 'The Dashboard compares what you spent with your plan, for a day, week, month or year, with a marker for where you would be if you spent evenly.',
        to: '/docs/guide/dashboard',
    },
    {
        title: 'Every transaction in one place',
        text: 'Type them in, import a CSV from your bank, or link your bank and have them added every morning. Duplicates are caught for you.',
        to: '/docs/guide/transactions',
    },
    {
        title: 'A budget that does the maths',
        text: 'Answer a few questions about your pay, your bills and what you are saving for, and it works out a monthly plan you can change.',
        to: '/docs/guide/budget',
    },
    {
        title: 'Subscriptions, spotted for you',
        text: 'Rent, phone, streaming: add them once and each charge appears on its date. Repeating charges from your bank are suggested automatically.',
        to: '/docs/guide/subscriptions',
    },
    {
        title: 'Safe by default',
        text: 'Two-factor sign-in, read-only bank access, encrypted bank tokens, and each person only ever sees their own data.',
        to: '/docs/guide/privacy-and-security',
    },
    {
        title: 'Use it in public',
        text: 'Privacy mode blurs your amounts with one tap, so you can check your budget on the bus without sharing it.',
        to: '/docs/guide/privacy-and-security#privacy-mode',
    },
]

export default function Home() {
    return (
        <Layout title="Plan a budget and track every transaction"
            description="Budget Tracker: plan a budget, track every transaction (typed in, imported or synced from your bank), and see how the month is going.">
            <header className={styles.hero}>
                <div className={styles.heroInner}>
                    <h1 className={styles.title}>Know where your money goes</h1>
                    <p className={styles.tagline}>
                        Budget Tracker helps you plan a budget, keep track of every transaction, and see at a glance how the
                        day, week, month or year is going. It works in your browser, on iPhone and on Android.
                    </p>
                    <div className={styles.buttons}>
                        <Link className="button button--primary button--lg" to="/docs/guide/getting-started">Get started</Link>
                        <Link className={`button button--lg ${styles.ghost}`} href="https://managemymulah.netlify.app">Open the app</Link>
                    </div>
                </div>
            </header>
            <main className={styles.main}>
                <section className={styles.grid} aria-label="What it does">
                    {FEATURES.map(f => (
                        <Link key={f.title} to={f.to} className={styles.card}>
                            <h2 className={styles.cardTitle}>{f.title}</h2>
                            <p className={styles.cardText}>{f.text}</p>
                        </Link>
                    ))}
                </section>
                <section className={styles.paths}>
                    <div className={styles.path}>
                        <h2>Using the app</h2>
                        <p>Setting up your account, adding transactions, planning a budget, linking a bank, and what to do when something looks wrong.</p>
                        <Link to="/docs/guide/getting-started">Read the user guide →</Link>
                    </div>
                    <div className={styles.path}>
                        <h2>Working on it</h2>
                        <p>How the app is built, setting up your own copy, testing, and the rules that keep the code tidy.</p>
                        <Link to="/docs/developers/architecture">Read the developer docs →</Link>
                    </div>
                </section>
            </main>
        </Layout>
    )
}
