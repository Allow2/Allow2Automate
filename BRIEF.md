this project is the main app, it allows users to link Allow2 service with other services and machines.
The dev-plugins are plugins being developed locally and are symlinked from ../plugins/ they are separate repos.
The ../allow2automate-agent project is the project for the separate agent process a user can install on other machines to extend the reach of this project.
the agent is designed to be an exe/installer that this project downloads for the user and packages with a config file so it knows how to connect to this app.

It's important to understand you are using a shared folder in a different machine image. So I see paths different to you and you also cannot run the app or check my file system. So do all your work/debugging relative to this directory (and the parent directory .. )

