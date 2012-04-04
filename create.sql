-- date            time    x-edge-location sc-bytes c-ip         cs-method cs(Host)                        cs-uri-stem           sc-status cs(Referer)                             cs(User-Agent)                                                                                                                                  cs-uri-query
-- 2012-01-01      04:04:38        STL2    94867   75.163.245.102  GET     d1t7prvavxfqc7.cloudfront.net   /terrain/7/27/48.png    200     http://127.0.0.1/%7Echelm/freshymap/    Mozilla/5.0%20(Macintosh;%20Intel%20Mac%20OS%20X%2010_6_8)%20AppleWebKit/535.11%20(KHTML,%20like%20Gecko)%20Chrome/17.0.963.12%20Safari/535.11  -
-- 2012-01-01      04:04:38        STL2    90683   75.163.245.102  GET     d1t7prvavxfqc7.cloudfront.net   /terrain/7/27/50.png    200     http://127.0.0.1/%7Echelm/freshymap/    Mozilla/5.0%20(Macintosh;%20Intel%20Mac%20OS%20X%2010_6_8)%20AppleWebKit/535.11%20(KHTML,%20like%20Gecko)%20Chrome/17.0.963.12%20Safari/535.11  -


drop table rawlogs;


create table rawlogs (date date, time time, region text, file_size numeric, ip text, method text, host text, uri text, status text, referer text, useragent text, uriquery text, basemap text, x numeric, y numeric, z numeric, timestamp timestamp);



