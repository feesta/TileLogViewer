from gzip import GzipFile
from glob import glob
from os import path
from os.path import splitext
from csv import DictReader
import csv
import psycopg2

from boto.s3.connection import S3Connection

output_dir = '/directory/to/save/logfiles'

access = 'S3 Access Key'
secret = 'S3 Secret'
bucket = 'S3 Bucket Name'

if __name__ == '__main__':
    s3conn = S3Connection(access,secret)
    bucket = s3conn.get_bucket(bucket)

    pgconn = psycopg2.connect("dbname=DBNAME user=DBUSER")
    cur = pgconn.cursor()
    
    try:
        sql = """SELECT keyfile FROM logfiles ORDER BY timestamp DESC LIMIT 1"""
        cur.execute(sql)

        row = cur.fetchone()
        marker = row[0]
        print "Get log files from S3 starting with " + marker
    except:
        marker = ''
        print "Get log files from S3 starting at the beginning"

    file_dir = 'tile.stamen.com/'

# greater than 35000 files so be careful
    i = 0
    error_count = 0
    #for key in bucket.list('tile.stamen.com'):
    for key in bucket.list(prefix='tile.stamen.com', marker=marker):
        print key.name
        # check if key is already downloaded... continue if no
        fp = open(output_dir + key.name,'wb')
        key.get_contents_to_file(fp)
        i += 1
        #print i

    #exit()


    #for log_path in glob(input_dir + '/*.*'):
    #if 0:    
        base, ext = splitext(key.name)

        if ext == '.gz':
            fp = GzipFile(output_dir + key.name, 'r')
            name = base
        else: print 'file is not gzipped...'
        
        #print name

        fp.next()
        fp.next()
        input_rows = csv.reader(fp, dialect=csv.excel_tab)
        
        for row in input_rows:

            #print row

            try:
                uri = row[7].split('/')

                
                basemap = uri[1]
                x = int(uri[3])
                image_file = uri[4].split('.')
                y = int(image_file[0])
                z = int(uri[2])
                datetime = row[0] + ' ' + row[1]
           
                row = tuple(row) + (basemap, x, y, z, datetime, key.name)
# ['2012-01-01', '22:51:29', 'SFO5', '12507', '98.240.218.233', 'GET', 'd1t7prvavxfqc7.cloudfront.net', '/terrain/15/5246/11442.jpg', '200', 'http://www.somebits.com/multimap/map.html', 'Mozilla/5.0%20(Macintosh;%20Intel%20Mac%20OS%20X%2010.7;%20rv:8.0.1)%20Gecko/20100101%20Firefox/8.0.1', '-', '5246', '11442.jpg', '15', '']

                #sql = """INSERT INTO rawlogs VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""" % list(r for r in row)
                sql = """INSERT INTO tilelogs VALUES ('{0}', '{1}', '{2}', {3}, '{4}', '{5}', '{6}', '{7}', '{8}', '{9}', '{10}', '{11}', '{12}', {13}, {14}, {15}, '{16}', '{17}')""".format(*row)
                #print sql
                cur.execute(sql)
                pgconn.commit()
            except Exception as e:
                error_count += 1
                print '---------------'
                print e
                print row[7]
                print str(error_count) + ' errors'
                print '---------------'
                pgconn.rollback()

        pgconn.commit()

        sql = """INSERT INTO logfiles VALUES('{0}',NOW())""".format(key.name)
        try:
            cur.execute(sql)
            pgconn.commit()
        except Exception as e:
            print '++++++++++++++++++'
            print e
            print '++++++++++++++++++'
