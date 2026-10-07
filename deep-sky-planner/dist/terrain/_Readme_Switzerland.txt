**************************************************************************************************
*   DIGITAL LiDAR TERRAIN MODEL OF SWITZERLAND (incl. Liechtenstein), 0.5 arcsecond, Version 2   *
**************************************************************************************************


* Compiled and resampled by Sonny
* Website: https://sonny.4lima.de
* Twitter: https://twitter.com/SonnyLidarDTMs
* Alternatively you can also find the Terrain model with other Grid spaces on the Website.

======================================================================================


This Digital Elevation Model (exactly: Digital Terrain Model DTM - in contrast to Digital surface model DSM) is based on precise LiDAR elevation sources. They have been surveyed using the method of Airborne Laserscan (ALS). The accuracy and resolution of my models' elevations compared to satellite-based surveys like ASTER, ALOS, COPERNICUS or SRTM is significantly better. Especially in wooded areas, steep rocky terrain or narrow valleys.

The areas outside of the country's source data are filled with the best available Opensource elevation data of the particular region. Either these are based on LiDAR data too. Or otherwise from the SRTM-Mission https://en.wikipedia.org/wiki/Shuttle_Radar_Topography_Mission (SRTM Version 3.0 Global 1" DTMs, Download: https://dwtkns.com/srtm30m/ ) or also from Viewfinder Panoramas by Jonathan de Ferranti (1" DTMs, http://viewfinderpanoramas.org/dem3.html ). The source files have been aranged next and above each other and resampled with a sample spacing of 0.5" (0.5 arcseconds = 0,5/3600 degree, equals about 10 x 15 meters) or 1" (1 arcseconds = 1/3600 degree, equals about 20 x 30 meters) or 3" (3 arcseconds = 3/3600 degree, equals about 60 x 90 meters).

There's an overview map of the covered area in the file "_Region.jpg".

I used the worldwide popular file format of the SRTM datasets (.hgt files). Each elevation file (.hgt) represends exactly 1 x 1°, which could automatically derived from the filename. The filename specifies the southwest corner, e.g. "N47E014.hgt" represends an area from N47° to N48° latitude and E14° to E15° longitude.


PROJECTION and FILEFORMAT
*************************

- Coordinate Reference System: EPSG:4326 
- Geodetic date: WGS 84
- Coordinate system: geographic degrees
- 1 file contains 7201 x 7201 (0.5" model) or 3601 x 3601 (1" model) or 1201 x 1201 (3" model) elevation pixels
- Horizontal resolution: 0.5 arcsecond = 0.5/3600 degree = 0.000128889 Grad or 1 arcsecond = 1/3600 degree = 0.000277778 degree (1" model) or 3 arcseconds = 3/3600 degree = 0.000833333 degree (3" model)
- Vertical datum: Unmodified elevation system of the source data. Usually the national elevation system, based on Height above mean sea level
- Vertical resolution: 1 meter
- Byteorder: Motorola (Big Endian = most significant byte first)
- Filesize of one file: 103708802 Bytes (0.5" model) or 25934402 Bytes (1" model) or 2884802 Bytes (3" model)


VERSIONS
********

v1 (2018-04-13): Initial Release
v2 (2021-03-04): Integrated new Lidar source data of Switzerland, since swissALTI3D is OpenData now


SOURCES und LICENCE
*******************

This Terrain Model is OPEN, FREE and WITHOUT CHARGE. But it is licensed using the following LICENCE: Creative Commons Attribution 4.0 (CC BY 4.0),
look at https://creativecommons.org/licenses/by/4.0/deed.en

You are allowed to copy, redistribute the material in any medium or format as well as remix, transform, and build upon the material for any purpose, even commercially. Please mention my name (Sonny) and my Website (see at the top), thank you!


To create the terrain model of this territory I used the following FREE Opendata sources:


- Bundesamt für Landestopografie swisstopo: swissALTI3D DTM 2m
https://www.swisstopo.admin.ch/de/geodata/height/alti3d.html

- Areas outside of the country's source data: open file "_Datasources.txt" within the downloads "Europe DTM 1" or "Europe DTM 3" on https://sonny.4lima.de
