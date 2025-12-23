require("dotenv").config({
    path: `.env`,
});

module.exports = {
    siteMetadata: {
        siteUrl: "https://zang.gallery",
        title: "zang - text-based NFTs",
        description:
            "Create and collect text-based NFTs. Poetry, prose, code, and HTML art on the blockchain.",
    },
    plugins: [
        "gatsby-plugin-postcss",
        {
            resolve: "gatsby-plugin-mdx",
            options: {
                extensions: [".mdx", ".md"],
            },
        },
        {
            resolve: "gatsby-source-filesystem",
            options: {
                name: "pages",
                path: "./src/pages/",
            },
            __key: "pages",
        },
    ],
};
