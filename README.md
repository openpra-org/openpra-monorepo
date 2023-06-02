# OpenPRA Monorepo

## Getting Started

You need `pnpm`, `nvm`, and `node` installed.

### Installing PNPM
#### On Windows
```shell
winget install pnpm
```
#### On MacOS
Ensure that you have [Homebrew](https://brew.sh) installed. 
If not, run this script in Terminal `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"`
Finally, install pnpm
```shell
brew install pnpm
```
#### On Linux
You don't need instructions do you big boy. DuckDuckGo it if you do.

### Installing NVM
#### On Windows
* Download and install [nvm-setup.exe](https://github.com/coreybutler/nvm/releases)
* Logout then login to add nvm and pnpm to your PowerShell `PATH`

### Installing Node
* We are sticking with `v20.2.0` since it will have [LTS support](https://nodejs.dev/en/about/releases/) `10/2023` through `06/2025`.
```shell
nvm install 20.2.0
nvm use 20.2.0
```

### Setup
```shell
pnpm setup
pnpm install
pnpm install --global nx@16.3.1 #you could also try nx@latest but ymmv
```
* On Windows, if you're unable to run `nx` post-install, set the following script execution policy in PowerShell. 
* IMPORTANT!!!: You will have to run this script everytime you open a PowerShell for development.
```shell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

### For Development: Serve frontend & backend 
```shell
nx serve frontend-web-editor
nx serve web-backend
```
Or, serve together
```shell
nx run-many -t serve
```

### For Deployment: Build frontend & backend
```shell
nx build web-editor
nx build web-backend
```
Or in parallel
```shell
nx run-many -t build
```

### Updating dependencies
```shell
npm i -g npm-check-updates
ncu -u
```