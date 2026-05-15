#!/bin/sh

# Define ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display instructions for Bash and Zsh
display_unix_instructions() {
    shell_profile="$1"
    echo "${GREEN}Add the following lines to your $shell_profile. After modifying your profile file, please log out and \n${GREEN}log back in for the changes to take effect, or source the file directly using:${NC}"
    echo "${YELLOW}echo 'export LD_LIBRARY_PATH=\"\$HOME/.local/lib/scram:\$LD_LIBRARY_PATH\"' >> \$HOME/$shell_profile${NC}"
    echo "${YELLOW}echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> \$HOME/$shell_profile${NC}"
    echo "${YELLOW}source ~/$shell_profile${NC}"
}

# Function to display instructions for CMD
display_cmd_instructions() {
    echo "${GREEN}Run the following commands in Command Prompt:${NC}"
    echo "${RED}setx PATH \"%PATH%;%USERPROFILE%\\.local\\bin\"${NC}"
    echo "${RED}setx LD_LIBRARY_PATH \"%USERPROFILE%\\.local\\lib\\scram\"${NC}"
}

# Function to display instructions for PowerShell
display_powershell_instructions() {
    echo "${GREEN}Run the following commands in PowerShell:${NC}"
    echo "${RED}\$env:PATH += \";\$env:USERPROFILE\\.local\\bin\"${NC}"
    echo "${RED}\$env:LD_LIBRARY_PATH += \";\$env:USERPROFILE\\.local\\lib\\scram\"${NC}"
    echo "${GREEN}To make these changes permanent, add them to your PowerShell profile.${NC}"
}

# Function to detect the shell and display appropriate instructions
detect_and_display_instructions() {
    case "$SHELL" in
        */bash)
            display_unix_instructions ".bash_profile"
            ;;
        */zsh)
            display_unix_instructions ".zprofile"
            ;;
        *)
            if command -v cmd.exe >/dev/null; then
                # Likely running under Windows
                if command -v powershell.exe >/dev/null; then
                    display_powershell_instructions
                else
                    display_cmd_instructions
                fi
            else
                # Fallback for other Unix-like shells
                display_unix_instructions ".profile"
            fi
            ;;
    esac
}

# Main function to start the script
main() {
    # Update shared library cache if running as root and ldconfig is available
    if [ "$(id -u)" -eq 0 ] && command -v ldconfig >/dev/null 2>&1; then
        echo "${GREEN}Updating shared library cache with ldconfig...${NC}"
        ldconfig
    fi

    echo "${GREEN}To ensure that your system can find the 'scram-cli', you need to update your environment variables.${NC}"
    detect_and_display_instructions
}

# Call the main function
main

