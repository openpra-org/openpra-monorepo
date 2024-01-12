job("Deployment") {

  failOn {
    nonZeroExitCode { enabled = true }
  }

  val registry = "packages.space.openpra.org/p/openpra/containers/"
  val image = "openpra-monorepo"
  val remote = "$registry$image"

  host("Deployment Tags") {
    // use kotlinScript blocks for usage of parameters
    kotlinScript("Generate slugs") { api ->

      api.parameters["commitRef"] = api.gitRevision()
      api.parameters["gitBranch"] = api.gitBranch()

      val branchName = api.gitBranch()
        .removePrefix("refs/heads/")
        .replace(Regex("[^A-Za-z0-9-]"), "-") // Replace all non-alphanumeric characters except hyphens with hyphens
        .replace(Regex("-+"), "-") // Replace multiple consecutive hyphens with a single hyphen
        .lowercase() // Convert to lower case for consistency

      val maxSlugLength = if (branchName.length > 48) 48 else branchName.length

      var branchSlug = branchName.subSequence(0, maxSlugLength).toString()

      if (branchName == "main") {
        branchSlug = "v2"
        api.parameters["buildType"] = "production"
        api.parameters["debugMode"] = "false"
        api.parameters["isReview"] = "false"
      } else {
        branchSlug = "review-$branchSlug"
        api.parameters["buildType"] = "development"
        api.parameters["debugMode"] = "true"
        api.parameters["isReview"] = "true"
      }

      api.parameters["branchSlug"] = branchSlug
      api.parameters["externalLinkLabel"] = branchSlug
      api.parameters["externalLinkUrl"] = "$branchSlug.app.openpra.org"
    }
  }

  /**
   * https://www.jetbrains.com/help/space/automation-dsl.html#job-parallel
   */
  parallel {

    host("Build Frontend") {

      requirements {
        workerTags("swarm-worker")
      }

      shellScript("docker build frontend"){
        interpreter = "/bin/bash"
        content = """
                          docker pull $remote:frontend-{{ branchSlug }} || true
                          docker build --no-cache --target frontend --build-arg BUILD_TYPE="{{ buildType }}" --tag="$remote:frontend-{{ branchSlug }}" -f ./docker/Dockerfile .
                          """
      }

      shellScript("docker push frontend"){
        interpreter = "/bin/bash"
        content = """
                          docker push "$remote:frontend-{{ branchSlug }}"
                          """
      }
    }

    host("Build Backend") {
      requirements {
        workerTags("swarm-worker")
      }

      shellScript("docker build backend"){
        interpreter = "/bin/bash"
        content = """
                            docker pull $remote:backend-{{ branchSlug }} || true
                            docker build --no-cache --target backend --build-arg BUILD_TYPE="{{ buildType }}" --tag="$remote:backend-{{ branchSlug }}" -f ./docker/Dockerfile .
                            """
      }

      shellScript("docker push backend"){
        interpreter = "/bin/bash"
        content = """
                            docker push "$remote:backend-{{ branchSlug }}"
                            """
      }
    }
  }

  host("Stack Update") {

    requirements {
      workerTags("swarm-manager")
    }

    env["STACK_YML"] = "docker/stack.yml"

    env["IMAGE_FRONTEND"] = "$remote:frontend-{{ branchSlug }}"
    env["IMAGE_BACKEND"] = "$remote:backend-{{ branchSlug }}"

    env["APP_NAME"] = "v2-app-{{ branchSlug }}"
    env["HOST_URL"] = "{{ branchSlug }}.{{ project:APP_DOMAIN }}"

    env["CI_SENTRY_DSN"] = "{{ project:APP_SENTRY_DSN }}"
    env["CI_SENTRY_ENV"] = "{{ project:APP_SENTRY_ENV }}"
    env["CI_DEBUG"] = "{{ project:APP_DEBUG_MODE }}"

    env["ENV_SHARED_VOLUME_PATH"] = "{{ project:SHARED_VOLUME_PATH }}/openpra-app/v2/{{ branchSlug }}/volumes"

    // secrets
    env["DSF_JWT_SECRET_KEY"] = "{{ project:APP_JWT_SECRET_KEY }}"

    shellScript("create directories"){
      interpreter = "/bin/bash"
      content = """
                        mkdir -p ${'$'}ENV_SHARED_VOLUME_PATH/mongodb docker/secrets
                        """
    }

    shellScript("write secret files"){
      interpreter = "/bin/bash"
      content = """
                        echo ${'$'}DSF_JWT_SECRET_KEY > docker/secrets/DSF_JWT_SECRET_KEY.secret
                        """
    }

    shellScript("docker stack deploy"){
      interpreter = "/bin/bash"
      content = """
                            docker compose -f ${'$'}STACK_YML config
                            docker stack deploy -c ${'$'}STACK_YML ${'$'}APP_NAME
                            """
    }

    kotlinScript("update deployments target") { api ->

      val label: String? = api.parameters["externalLinkLabel"]
      val url: String = api.parameters["externalLinkUrl"]!!
      val externalLink = ExternalLink(label, url)

      api.space().projects.automation.deployments.start(
        project = api.projectIdentifier(),
        targetIdentifier = TargetIdentifier.Key("v2-app"),
        version = "job-" + api.executionNumber(),
        syncWithAutomationJob = true,
        externalLink = externalLink
      )
    }
  }
}

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
            shellScript("nx run-many -t build"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run-many -t build
                        """
            }
        }

        host("Test") {
            shellScript("nx run-many -t test"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run-many -t test
                        """
            }
        }

        host("Lint") {
            shellScript("nx run-many -t lint"){
                interpreter = "/bin/bash"
                content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --no-cache --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile . && \
                        docker run --rm "$remote:{{ branchSlug }}" nx run-many -t lint
                        """
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
