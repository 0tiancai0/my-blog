// tina/config.ts
import { defineConfig } from "tinacms";
var branch = process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || process.env.HEAD || "main";
var config_default = defineConfig({
  branch,
  // Get these from https://app.tina.io
  clientId: process.env.TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",
  build: {
    outputFolder: "admin",
    publicFolder: "public"
  },
  search: {
    tina: {
      indexerToken: process.env.TINA_SEARCH_TOKEN || "",
      stopwordLanguages: ["zh"]
    },
    indexBatchSize: 100,
    maxSearchIndexFieldLength: 300
  },
  schema: {
    collections: [
      {
        name: "post",
        label: "Blog Posts",
        path: "src/content/posts",
        format: "md",
        ui: {
          router: ({ document }) => `/posts/${document._sys.filename}`
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true
          },
          {
            type: "datetime",
            name: "pubDate",
            label: "Published Date",
            required: true
          },
          {
            type: "string",
            name: "description",
            label: "Description",
            ui: {
              component: "textarea"
            }
          },
          {
            type: "image",
            name: "heroImage",
            label: "Cover Image"
          },
          {
            type: "string",
            name: "tags",
            label: "Tags",
            list: true
          },
          {
            type: "rich-text",
            name: "body",
            label: "Body",
            isBody: true
          }
        ]
      }
    ]
  }
});
export {
  config_default as default
};
