# rf-3d-view

3d View library for Rapidfacture apps: BabylonJS wrap and usefull 3d functions

## Installation

* exclude the folder `global/common` from git in your `.gitignore`
```
global/common
```
* add actual version of `rf-frontend-common` to you package.json

* copy the `3dView` folder from this package into your project using grunt
* include the important required files (variables.scss, etc.) in correct order - stick to other grunt files
* don't use `3dView` as folder name in AngularJS target project. It leads to wrong sorting


## Development
* edit the files in the common folder in your project
* when working correct, update the `rf-3d-view` project
* push the new version to our server and publish on npm
