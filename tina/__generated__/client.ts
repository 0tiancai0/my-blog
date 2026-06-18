import { createClient } from "tinacms/dist/client";
import { queries } from "./types.js";
export const client = createClient({ url: 'http://localhost:4001/graphql', token: '96d9c1d5aa3bcd4e015875432546aca2ab1ad1ac', queries,  });
export default client;
  