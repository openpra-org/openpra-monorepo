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
    val buildType = "development"
    val urlSlugPrefix = "review-"

    host("Deployment Tags") {
      // use kotlinScript blocks for usage of parameters
      kotlinScript("Generate slugs") { api ->

        api.parameters["commitRef"] = api.gitRevision()
        api.parameters["gitBranch"] = api.gitBranch()

        val branchName = api.gitBranch()
          .subSequence(1, 16)
          .toString()
          .replace(Regex("[^A-Za-z0-9-]"), "-") // Replace all non-alphanumeric characters except hyphens with hyphens
          .replace(Regex("-+"), "-") // Replace multiple consecutive hyphens with a single hyphen
          .lowercase() // Convert to lower case for consistency

        if (branchName == "main") {
          api.parameters["branchSlug"] = branchName
        } else {
          api.parameters["branchSlug"] = urlSlugPrefix + branchName
        }
      }
    }


    /**
     * https://www.jetbrains.com/help/space/automation-dsl.html#job-parallel
     */
    parallel {

        host("Build") {
            shellScript("frontend-web-editor:build"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run frontend-web-editor:build
                        """
            }

            shellScript("web-backend:build"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run web-backend:build
                        """
            }

            shellScript("shared-types:build"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run shared-types:build
                        """
            }
            shellScript("model-generator:build"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run model-generator:build
                        """
            }
            shellScript("scram-node:build"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run scram-node:build
                        """
            }
            shellScript("mef-schema:build"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run mef-schema:build
                        """
            }
        }

        host("Tests") {
            shellScript("frontend-web-editor:test"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run frontend-web-editor:test
                        """
            }

            shellScript("frontend-web-editor:e2e-cli"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run frontend-web-editor:e2e-cli
                        """
            }

            shellScript("web-backend:test"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run web-backend:test
                        """
            }

            shellScript("web-backend:e2e"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run web-backend:e2e
                        """
            }

            shellScript("shared-types:test"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run shared-types:test
                        """
            }
            shellScript("model-generator:test"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run model-generator:test
                        """
            }
            shellScript("scram-node:test"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run scram-node:test
                        """
            }
            shellScript("mef-schema:test"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run mef-schema:test
                        """
            }
        }

        host("Lint") {
            shellScript("frontend-web-editor:lint"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run frontend-web-editor:lint
                        """
            }

            shellScript("web-backend:lint"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run web-backend:lint
                        """
            }

            shellScript("shared-types:lint"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run shared-types:lint
                        """
            }
            shellScript("model-generator:lint"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run model-generator:lint
                        """
            }
            shellScript("scram-node:lint"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run scram-node:lint
                        """
            }
            shellScript("mef-schema:lint"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run mef-schema:lint
                        """
            }
        }
        }
    }

    host("Remove") {
        shellScript("docker rmi") {
            interpreter = "/bin/bash"
            content = """
                        docker rmi "$remote:{{ branchSlug }}" || true
                        """
        }
    }
}
