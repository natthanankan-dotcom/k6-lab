# K6 lab results

All runs were made on 30 October 2026 with k6 v2.2.0 on Windows 11, against https://quickpizza.grafana.com.

## Part 0
- Step 0.1, http_req_duration: 384.16 ms (one request, so avg, min, med, max, p(90) and p(95) are all 384.16 ms).
- Step 0.2, requests, rate and p(95), and why the rate stays below 5: 70 requests, 3.26 requests/s, p(95) = 711.77 ms. One iteration of a virtual user is one request (about 0.45 s on average) plus `sleep(1)`, so it takes about 1.5 s (iteration_duration avg = 1.53 s). Each user therefore sends only about 1 / 1.5 ≈ 0.65 requests per second, and 5 users send about 5 × 0.65 ≈ 3.3 requests per second. The rate could reach 5/s only if a request took no time and there was no think time.
- Step 0.6, exit code of the normal run and of the run with P95=300: normal run exit code 0 (p(95) = 442.96 ms < 1500 ms, all thresholds passed). With `-e P95=300` the exit code was 99 (p(95) = 425.26 ms, which is not < 300 ms, so the http_req_duration threshold was crossed).
- Step 0.7, rules that passed, p(95), p(99), exit code after your change: with 3 VUs for 30 s, all four rules passed: `http_req_duration p(95)<1000` (p(95) = 429.32 ms), `http_req_duration p(99)<1500` (p(99) = 492.54 ms), `http_req_failed rate<0.01` (0.00%) and `checks rate>0.99` (100.00%). Exit code 0. I then changed the 95% limit from 1 second to 300 ms (`k6 run -e P95=300 07-requirement.js`). The p(95) rule failed (p(95) = 534.28 ms) and the exit code was 99.
- Step 0.8, what was wrong, and how the checks showed it: with 5 VUs for 20 s, the checks `no pepperoni` failed 8 out of 74 times (89% passed) and `no knife needed` failed 24 out of 74 times (67% passed). `explore.js` showed that QuickPizza names the topping `"Pepperoni"` and the tool `"Knife"` with a capital letter, while the script sent `'pepperoni'` and `'knife'`. The API matches the names exactly, so it did not exclude anything and kept recommending pizzas with pepperoni or a knife. After changing the request to `excludedIngredients: ['Pepperoni']` and `excludedTools: ['Knife']`, all 216 checks passed (100%). The recommendation is random, so one manual request has a good chance of returning a pizza that has no pepperoni and needs no knife by luck, and the bug looks absent. Under load, 74 requests sample many random pizzas, and the check failure rate makes the bug visible as a percentage.

## Part A results
| Step | Test type    | Users | Req/s | p(95)     | Max     | Failed | Checks            |
| ---- | ------------ | ----- | ----- | --------- | ------- | ------ | ----------------- |
| A1   | Smoke        | 1     | 0.47  | 499.56 ms | 538 ms  | 0.00%  | 100.00% (20/20)   |
| A2   | Average load | 3     | 1.27  | 674.71 ms | 1.36 s  | 0.00%  | 100.00% (304/304) |
| A3   | Stress       | 5     | 2.03  | 690.51 ms | 2.02 s  | 0.00%  | 100.00% (488/488) |
| A4   | Spike        | 5     | 0.99  | 588.86 ms | 1.37 s  | 0.00%  | 100.00% (188/188) |
| A5   | Soak         | 2     | 0.91  | 772.44 ms | 2.78 s  | 0.00%  | 100.00% (804/804) |

All five runs passed every threshold (exit code 0). The p(95) per group was: A2 home 675.67 ms and recommendation 649.04 ms; A3 home 570.64 ms and recommendation 846.02 ms; A4 home 527.13 ms and recommendation 666.75 ms; A5 home 747.19 ms and recommendation 856.31 ms.

## Part B
1. See the results table above.
2. A virtual user runs its iterations one after another, and each iteration waits for the response (about 0.45 s) and then sleeps for 1 s. One iteration takes about 1.5 s, so each user makes about 0.65 requests per second and 5 users make about 3.3 requests per second (3.26/s measured). The think time, not the server, limits the rate.
3. Only slightly. The overall p(95) went from 674.71 ms with 3 users to 690.51 ms with 5 users (+2%), and the recommendation group went from 649.04 ms to 846.02 ms, while the home page group even went down (675.67 ms to 570.64 ms). The maximum went from 1.36 s to 2.02 s. No request failed in either run. The request rate went up from 1.27/s to 2.03/s, so the server handled 60% more traffic at almost the same speed. This means that 5 users are still deep inside the operational envelope of QuickPizza, which serves people learning K6 all over the world. Our "stress" test is not above the normal load of this system, so it cannot show where the system starts to slow down or fail. The small differences are within the normal noise of the internet and of a shared site.
4. The response time hardly rose during the spike. In 10-second windows, the p(95) was 421 to 589 ms with 1 user before the spike, 436 to 574 ms with 5 users during the spike, and 361 to 500 ms with 1 user after it. The p(95) was back at its earlier level in the first 10-second window after the drop, so the recovery took at most about 10 seconds, the resolution of the report. Five users are not a real spike for this system.
5. The error rate did not get worse: http_req_failed stayed at 0.00% for all 603 requests. The response time got a little worse near the end. In the first 3 minutes at 2 users the average was 462 ms and the mean 10-second p(95) was 557 ms, with one 10-second window above 1 s. In the last 3 minutes the average was 540 ms and the mean p(95) was 741 ms, with five windows above 1 s. With only 10 minutes, 2 users and a shared site, this is more likely noise from the internet or from other users of QuickPizza than a real degradation, and a longer test against our own system would be needed to tell. A soak test of several hours can reveal a memory leak, where the application slowly uses more memory until it slows down or crashes. It can also reveal connections that are never released (a database connection pool that runs out), and log or temporary files that fill the disk.
6. The average hides the slowest users. A few fast requests can make the average look good while 1 request in 20 is very slow. In A5, the average was 476.49 ms but the maximum was 2.78 s. p(95) states what 95% of users actually experience, so it is closer to how users feel the system, and it is a stable rule that one extreme outlier, which affects the maximum, cannot fail on its own.
7. (a) Network: our requests travel from Thailand over the public internet to the QuickPizza server, so the latency, the routing and the load on the network change from minute to minute, while a lab system sits on a fast local network with almost no latency. (b) Shared load and hardware: other people around the world run K6 against QuickPizza at the same time and share its CPU, memory and rate limits, and its hardware and caches are unknown to us. A lab system runs only our traffic on known hardware, so its numbers are more repeatable. In addition, our own laptop, Wi-Fi and other programs running on it also add noise.
8. A test with hundreds of users is a large amount of traffic. Against a site that we do not own, it can slow the site down or take it down for its real users, which is a denial-of-service attack. It is unethical and can be illegal (for example under the Thai Computer Crime Act), and it breaks the terms of service of most sites. It can also cost the owner money for extra servers and bandwidth, and get our IP address blocked. We do not know the capacity of the site either, so we cannot limit the harm. Such tests need our own system or written permission from the owner.
9. App: LINE.
   - Vague requirement: "Sending a message in LINE should be fast, even when many people use it."
   - Testable requirement: "With 500 users each sending one message every 5 seconds for 10 minutes, the send message API answers 95% of requests within 500 ms and 99% within 1 s, fewer than 0.1% of requests fail, and every successful answer contains a message ID."
   - K6 options and thresholds that check it (run only against our own test system):

   ```js
   export const options = {
     stages: [
       { duration: '1m', target: 500 },
       { duration: '10m', target: 500 },
       { duration: '1m', target: 0 },
     ],
     thresholds: {
       'http_req_duration{name:send_message}': ['p(95)<500', 'p(99)<1000'],
       'http_req_failed{name:send_message}': ['rate<0.001'],
       checks: ['rate>0.999'],
     },
   };
   ```

   Each request is tagged with `{ tags: { name: 'send_message' } }`, the check verifies that the answer has a message ID, and each user sleeps 5 seconds between messages.
