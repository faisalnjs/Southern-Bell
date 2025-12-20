# The Southern Bell

![Banner](banner.png)

> This project has been taken offline and is no longer maintained.

Valley Stream South High School's online school newspaper website

- Articles & PDF Newspapers
- Artwork & Anonymous Polls
- Easy Social Media Sharing
- Simple Content Management
- Individual Author Pages
- Useful Widgets & Alerts
- Many More Features

![Wakatime](https://wakatime.com/badge/user/074621a8-639e-4f3e-b6d9-f23b6bb481a9/project/2b675577-fc77-4320-ad6f-c728de7ad7bc.svg)
![Github Issues](https://img.shields.io/github/issues/faisalnjs/Southern-Bell?style=flat&logo=github&label=GitHub%20Issues&color=mediumseagreen)
![License](https://img.shields.io/badge/DWS-orange?label=License)

## Development

`npm install`
`nodemon index.js --watch index.js`

Nodemon will start a development server at `localhost:3000`

![Deploy Node.js App](https://github.com/faisalnjs/Southern-Bell/actions/workflows/dev.yml/badge.svg?branch=dev)

## Production

Files are transferred to the host using the GitHub Action automation workflow at [.github\workflows\prod.yml](https://github.com/faisalnjs/Southern-Bell/tree/prod/.github/workflows/prod.yml).

![Deploy Node.js App](https://github.com/faisalnjs/Southern-Bell/actions/workflows/prod.yml/badge.svg)

## CMS

To access the CMS, navigate to the `/admin` path to be redirected to the admin panel.

The CMS is **required** to run this project, and you must provide a valid API key to connect to the CMS server. The private CMS repository can be found at [dangoweb/cms-repository](https://github.com/dangoweb/cms-repository).
