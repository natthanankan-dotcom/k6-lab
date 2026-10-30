import { journey } from './journey.js';

export const options = {
  stages: [
    { duration: '30s', target: 1 }, // 1 user for 30 s
    { duration: '5s', target: 5 }, // jump to 5 users
    { duration: '30s', target: 5 }, // hold the spike
    { duration: '5s', target: 1 }, // drop back to 1 user
    { duration: '1m', target: 1 }, // recover at 1 user
    { duration: '10s', target: 0 }, // ramp down
  ],
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{group:::home}': ['p(95)<1000'],
    'http_req_duration{group:::recommendation}': ['p(95)<1500'],
  },
};

export default function () {
  journey();
}
