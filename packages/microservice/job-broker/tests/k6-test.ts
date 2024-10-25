// stress-test.js
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import quantifyRequests from "./quantifyRequests.json";

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Ramp up to 10 VUs over 30s
    { duration: "1m", target: 10 }, // Stay at 10 VUs for 1m
    { duration: "30s", target: 0 }, // Ramp down to 0 VUs over 30s
  ],
};

const latencies = new Trend("latencies");
const requestsSent = new Counter("requests_sent");
const responsesReceived = new Counter("responses_received");

export default function () {
  const endpoint = "http://localhost:3000/api/quantify/ftrex"; // Adjust if necessary

  // Randomly select a request from the preprocessed data
  const requestIndex = Math.floor(Math.random() * quantifyRequests.length);
  const quantifyRequest = quantifyRequests[requestIndex];

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const startTime = new Date().getTime();

  const res = http.post(endpoint, JSON.stringify(quantifyRequest), { headers });

  const latency = new Date().getTime() - startTime;
  latencies.add(latency);
  requestsSent.add(1);

  const success = check(res, {
    "status is 201": (r) => r.status === 201,
  });

  if (success) {
    responsesReceived.add(1);
  } else {
    console.error(`Request failed with status ${String(res.status)}`);
  }

  sleep(1);
}
