#!/usr/bin/python

import cgi
import cgitb; cgitb.enable()
import psycopg2, psycopg2.extras
import math, time
import simplejson

print "Content-type: text/json"
print


querystring = cgi.FieldStorage()
if "x" not in querystring or "y" not in querystring or "z" not in querystring:
    print "<h1>error: need xyz: url?x={X}&y={Y}&z={Z}</h1>"
    print
    exit()

x = int(querystring["x"].value)
y = int(querystring["y"].value)
z = int(querystring["z"].value)

tile_id = None
if "id" in querystring:
    tile_id = str(querystring["id"].value)

#print "x, y, z: " + str(x) + ", " + str(y) + ", " + str(z)

# get all the tiles within this shape (down to z+5)
# for each zoom, it is x*2, y*2, z+1

conn = psycopg2.connect("dbname=DBNAME user=DBUSER")
cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

if 'layer' in querystring:
    basemap = """ AND basemap = '{0}'""".format(str(querystring["layer"].value)) 
else:
    #basemap = """ AND basemap = 'watercolor'""" 
    #basemap = """ AND (basemap = 'toner' OR basemap = 'terrain' OR basemap = 'watercolor')"""
    basemap = """ AND (basemap = 'toner' OR basemap = 'watercolor')"""

zooms = 10
between = ''
for zoom in range(z, z+zooms):
    dz = zoom - z
    pz = pow(2,dz)
    if dz >= 1: between += " OR "
    between += """( 
                x BETWEEN {0} AND {1}
                AND y BETWEEN {2} AND {3}
                AND z = {4}
                )""".format(x*pz, x*pz+pz-1, y*pz, y*pz+pz-1, zoom)

sql = """SELECT DISTINCT x,y,z 
           FROM tilelogs 
          WHERE ({0}){1}""".format(between, basemap)

if 'exit' in querystring:
    print sql
    exit()
cur.execute(sql)
rows = cur.fetchall()


output = {'zooms':{}, 'tile_id':tile_id}
for row in rows:
    x = int(row['x'])
    y = int(row['y'])
    z = int(row['z'])

    if z not in output['zooms']: output['zooms'][z] = []

    output['zooms'][z].append({'x':int(row['x']), 'y':int(row['y']), 'z':int(row['z'])})

print simplejson.dumps(output, separators=(',',':'))
