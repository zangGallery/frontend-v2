import { Fragment } from "react";
import { Link } from "gatsby";
import { Header } from "../components";

import "../styles/tailwind.css";
import "../styles/globals.css";

const NotFoundPage = () => {
    return (
        <div className="min-h-screen bg-ink-950">
            <Header />
            <main className="flex flex-col items-center justify-center px-4 py-20">
                {/* ASCII Art 404 */}
                <pre className="text-accent-cyan font-mono text-xs sm:text-sm md:text-base leading-tight mb-8 select-none">
                    {`
 ██╗  ██╗ ██████╗ ██╗  ██╗
 ██║  ██║██╔═████╗██║  ██║
 ███████║██║██╔██║███████║
 ╚════██║████╔╝██║╚════██║
      ██║╚██████╔╝     ██║
      ╚═╝ ╚═════╝      ╚═╝
`}
                </pre>

                {/* Message */}
                <div className="text-center max-w-md">
                    <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
                        Page Not Found
                    </h1>
                    <p className="text-ink-400 mb-8 font-mono text-sm">
                        The text you're looking for doesn't exist here.
                        <br />
                        Perhaps it was never written...
                    </p>

                    {/* ASCII decoration */}
                    <div className="text-ink-600 font-mono text-xs mb-8">
                        <span className="text-ink-500">{">"}</span> searching
                        for page...
                        <br />
                        <span className="text-red-500">{">"}</span> ERROR: file
                        not found
                        <br />
                        <span className="text-ink-500">{">"}</span> redirecting
                        to safety...
                    </div>

                    {/* CTA */}
                    <Link
                        to="/"
                        className="inline-flex items-center px-6 py-3 bg-accent-cyan text-ink-950 font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors"
                    >
                        Back to Gallery
                    </Link>
                </div>

                {/* Decorative elements */}
                <div className="mt-16 text-ink-800 font-mono text-xs opacity-50">
                    ╔══════════════════════════════════════╗
                    <br />
                    ║
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    ║
                    <br />
                    ║ &nbsp;&nbsp;TEXT is art. This page isn't. &nbsp;&nbsp;║
                    <br />
                    ║
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    ║
                    <br />
                    ╚══════════════════════════════════════╝
                </div>
            </main>
        </div>
    );
};

export default NotFoundPage;

export function Head() {
    return (
        <Fragment>
            <title>404 - Page Not Found | zang</title>
            <meta name="description" content="Page not found on zang.gallery" />
        </Fragment>
    );
}
