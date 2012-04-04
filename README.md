When hosting map tiles, you get lots of log files of the areas people view your maps. Ours get stored by CloudFront to an S3 bucket. This set of scripts simplify the process of getting log files hosted in an S3 bucket and importing them into a PostGRES database. Then running a tileserver that generates coordinates for the viewed tiles which are rendered in canvas in the browser.

![Logs for Northeastern Europe](https://github.com/feesta/TileLogViewer/raw/master/screenshots/northerneurope_text.png)

## To use: ##

* Update username/dbname for your PostGRES database in `importlogs.py` and `tile.cgi`.
* Update paths to correct locations.
* Add your AWS S3 access key, secret, and bucket name to the import script
* Create an output directory and point the import script to it. This is where the log files will be stored.
* Run the `create.sql` script with a command like `psql -U username dbname < create.sql`
* Run the import script (This could take a while if you have tens of thousands of log files like we did)
* Make sure the path of the `index.html` is pointing to the `tile.cgi`. The CGI script will pull tile coordinates from PostGRES and send them as JSON to ModestMaps.
* View in the browser.
 
To continuously pull the log files, I run `0-59 * * * * python /absolute/path/importlogs.py >> /absolute/path/importlogs.log` every minute (`crontab -e`). This also logs the importing so I can check for problems.