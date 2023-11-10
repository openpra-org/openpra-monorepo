/**
 * JetBrains Space Automation
 * This Kotlin script file lets you automate build activities
 * For more info, see https://www.jetbrains.com/help/space/automation.html
 */

/**
 * https://www.jetbrains.com/help/space/automation-dsl.html#job
 */
job("Build, Test, Lint, Cleanup") {

    /**
     * https://www.jetbrains.com/help/space/automation-dsl.html#job-requirements
     */
    requirements {
        workerTags("swarm-worker")
    }

    failOn {
        nonZeroExitCode { enabled = false }
    }

    val registry = "packages.space.openpra.org/p/openpra/containers/"
    val image = "openpra-monorepo"
    val remote = "$registry$image"

    host("Tag") {
        // use kotlinScript blocks for usage of parameters
        kotlinScript("set git revision as tag") { api ->
            api.parameters["imageTag"] = api.gitRevision()
        }
    }

    /**
     * https://www.jetbrains.com/help/space/automation-dsl.html#job-parallel
     */
    parallel {

        host("Build") {
            shellScript("nx run-many -t build"){
                interpreter = "/bin/bash"
                content = """
                        docker build --target=base --tag="$remote:{{ imageTag }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ imageTag }}" nx run-many -t build
                        """
            }
        }

        host("Test") {
            shellScript("nx run-many -t test"){
                interpreter = "/bin/bash"
                content = """
                        docker build --target=base --tag="$remote:{{ imageTag }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ imageTag }}" nx run-many -t test
                        """
            }
        }

        host("Lint") {
            shellScript("nx run-many -t lint"){
                interpreter = "/bin/bash"
                content = """
                        docker build --target=base --tag="$remote:{{ imageTag }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ imageTag }}" nx run-many -t lint
                        """
            }
        }
    }

    host("Remove") {
        shellScript("docker rmi") {
            interpreter = "/bin/bash"
            content = """
                        docker rmi "$remote:{{ imageTag }}" || true
                        """
        }
    }
}
