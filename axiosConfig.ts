import axios from "axios";

export * from "./jest.config";

axios.interceptors.request.use((req) => {
  console.log(req);
  return req; // Ensure the request config is returned
});
