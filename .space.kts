job("Monorepo CD") {

   val registry = "packages-space.openpra.org/p/openpra/containers/"
   val image = "openpra-monorepo"
   val remote = "$registry$image"

    // Users will be able to redefine these parameters in custom job run.
    // See the 'Customize job run' section
    parameters {
        text("Host-Performance", value = "any") {
            options("any", "low", "medium", "high")
        }
        text("NumWorkers", value = "1", description = "min: 2, max: 1024, auto: 1, default (main): 32")
        text("NumBrokers", value = "1", description = "min: 2, max: 8, auto: 1, default (main): 3")
        text("NumBackends", value = "1", description = "min: 2, max: 8, auto: 1, default (main): 3")
        text("NumFrontends", value = "1", description = "min: 2, max: 8, auto: 1, default (main): 3")
    }

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

       val maxSlugLength = if (branchName.length > 32) 32 else branchName.length
       var branchSlug = branchName.subSequence(0, maxSlugLength).toString()

       var numWorkers = (api.parameters["NumWorkers"] ?: "0").toInt()
       numWorkers = if (numWorkers > 1024) 1024 else numWorkers // never more than 1024 per deployment

       var numBrokers = (api.parameters["numBrokers"] ?: "0").toInt()
       numBrokers = if (numBrokers > 8) 8 else numBrokers // never more than 8 per deployment

       var NumBackends = (api.parameters["NumBackends"] ?: "0").toInt()
       NumBackends = if (NumBackends > 8) 8 else NumBackends // never more than 8 per deployment

       var NumFrontends = (api.parameters["NumFrontends"] ?: "0").toInt()
       NumFrontends = if (NumFrontends > 8) 8 else NumFrontends // never more than 8 per deployment

       if (branchName == "main") {
         branchSlug = "v2-app"
         api.parameters["buildType"] = "production"
         api.parameters["debugMode"] = "false"
         api.parameters["isReview"] = "false"
         api.parameters["numWorkers"] = if (numWorkers <= 1) "32" else numWorkers.toString() // 32 if unset
         api.parameters["numBrokers"] = if (numBrokers <= 1) "3" else numBrokers.toString()  // 3 if unset
         api.parameters["numBackends"] = if (numBackends <= 1) "3" else numBackends.toString() // 3 if unset
         api.parameters["numFrontends"] = if (numFrontends <= 1) "3" else numFrontends.toString() // 3 if unset
         // performance constraints
         api.parameters["workerPoolConstraint"]   = "node.labels.min_host_performance == low" // run on any node
         api.parameters["brokerPoolConstraint"]   = "node.labels.max_host_performance != low" // don't run on slow nodes
         api.parameters["backendPoolConstraint"]  = "node.labels.max_host_performance != low" // don't run on slow nodes
         api.parameters["frontendPoolConstraint"] = "node.labels.min_host_performance == low" // run on any node
       } else {
         branchSlug = "app-review-$branchSlug"
         api.parameters["buildType"] = "development"
         api.parameters["debugMode"] = "true"
         api.parameters["isReview"] = "true"
         api.parameters["numWorkers"] = if (numWorkers <= 1) "2" else numWorkers.toString() // 2 if unset
         api.parameters["numBrokers"] = if (numBrokers <= 1) "2" else numBrokers.toString()  // 2 if unset
         api.parameters["numBackends"] = if (numBackends <= 1) "2" else numBackends.toString() // 2 if unset
         api.parameters["numFrontends"] = if (numFrontends <= 1) "2" else numFrontends.toString() // 2 if unset
         // performance constraints
         api.parameters["workerPoolConstraint"]   = "node.labels.min_host_performance == low" // run on any node
         api.parameters["brokerPoolConstraint"]   = "node.labels.min_host_performance == low" // run on any node
         api.parameters["backendPoolConstraint"]  = "node.labels.min_host_performance == low" // run on any node
         api.parameters["frontendPoolConstraint"] = "node.labels.min_host_performance == low" // run on any node
       }

       api.parameters["branchSlug"] = branchSlug
       api.parameters["externalLinkLabel"] = branchSlug
       api.parameters["externalLinkUrl"] = "$branchSlug.openpra.org"
     }
   }

   host("Build") {

     requirements {
       workerTags("swarm-worker")
     }

     shellScript("build-image"){
       interpreter = "/bin/bash"
       content = """
                           docker pull $remote:deploy-{{ branchSlug }} || true
                           docker build --build-arg BUILD_TYPE="{{ buildType }}" --tag="$remote:deploy-{{ branchSlug }}" -f ./docker/Dockerfile .
                           docker push "$remote:deploy-{{ branchSlug }}"
                           """
     }
   }

   host("Stack Update") {

     requirements {
       workerTags("swarm-manager")
     }

     env["STACK_YML"] = "docker/stack.yml"

     env["IMAGE_BACKEND"] = "$remote:deploy-{{ branchSlug }}"

     env["APP_NAME"] = "v2-{{ branchSlug }}"
     env["HOST_URL"] = "{{ branchSlug }}.{{ project:APP_DOMAIN }}"

     env["NUM_WORKERS"] = "{{ numWorkers }}"
     env["NUM_BROKERS"] = "{{ numBrokers }}"
     env["NUM_BACKENDS"] = "{{ numBackends }}"
     env["NUM_FRONTENDS"] = "{{ numFrontends }}"

     env["DEPLOYMENT_WORKER_POOL"] = "{{ workerPoolConstraint }}"
     env["DEPLOYMENT_BROKER_POOL"] = "{{ brokerPoolConstraint }}"
     env["DEPLOYMENT_BACKEND_POOL"] = "{{ backendPoolConstraint }}"
     env["DEPLOYMENT_FRONTEND_POOL"] = "{{ frontendPoolConstraint }}"

     env["CI_DEBUG"] = "{{ project:APP_DEBUG_MODE }}"
     env["CI_ALLOWED_HOST"] = ".{{ project:APP_DOMAIN }}"
     env["CI_BUILD_TYPE"] = "{{ buildType }}"

     env["ENV_SHARED_VOLUME_PATH"] = "{{ project:SHARED_VOLUME_PATH }}/openpra-app/v2/{{ branchSlug }}/volumes"

     // secrets
     env["DSF_JWT_SECRET_KEY"] = "{{ project:APP_JWT_SECRET_KEY }}"

     shellScript("create directories"){
       interpreter = "/bin/bash"
       content = """
                         mkdir -p ${'$'}ENV_SHARED_VOLUME_PATH/mongodb ${'$'}ENV_SHARED_VOLUME_PATH/rabbitmq docker/secrets
                         """
     }

     shellScript("write secret files"){
       interpreter = "/bin/bash"
       content = """
                         echo ${'$'}DSF_JWT_SECRET_KEY > docker/secrets/DSF_JWT_SECRET
                         """
     }

     shellScript("docker stack deploy"){
       interpreter = "/bin/bash"
       content = """
                             docker compose -f ${'$'}STACK_YML config
                             docker stack deploy -c ${'$'}STACK_YML --with-registry-auth ${'$'}APP_NAME
                             """
     }

     kotlinScript("update deployments target") { api ->

       val label: String? = api.parameters["externalLinkLabel"]
       val url: String = "https://" + api.parameters["externalLinkUrl"]!!
       val externalLink = ExternalLink(label, url)

       api.space().projects.automation.deployments.start(
         project = api.projectIdentifier(),
         targetIdentifier = TargetIdentifier.Key("v2-app"),
         version = label + "-" + api.executionNumber(),
         syncWithAutomationJob = true,
         externalLink = externalLink
       )
     }
   }
 }

job("Monorepo CD Cleanup") {

  startOn {
    codeReviewClosed{
      branchToCheckout = CodeReviewBranch.MERGE_REQUEST_SOURCE
    }
  }

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

      val maxSlugLength = if (branchName.length > 32) 32 else branchName.length

      var branchSlug = branchName.subSequence(0, maxSlugLength).toString()

      if (branchName == "main") {
        branchSlug = "v2-app"
        api.parameters["buildType"] = "production"
        api.parameters["debugMode"] = "false"
        api.parameters["isReview"] = "false"
      } else {
        branchSlug = "app-review-$branchSlug"
        api.parameters["buildType"] = "development"
        api.parameters["debugMode"] = "true"
        api.parameters["isReview"] = "true"
      }

      api.parameters["branchSlug"] = branchSlug
      api.parameters["externalLinkLabel"] = branchSlug
      api.parameters["externalLinkUrl"] = "$branchSlug.openpra.org"
    }
  }

  host("Remove Stack") {
    requirements {
      workerTags("swarm-manager")
    }

    env["APP_NAME"] = "v2-{{ branchSlug }}"

    shellScript("docker stack rm"){
      interpreter = "/bin/bash"
      content = """
                             docker stack rm ${'$'}APP_NAME
                             """
    }
  }
}

job("Monorepo CI") {

    failOn {
        nonZeroExitCode { enabled = true }
    }

    requirements {
      workerTags("swarm-worker")
    }

    val registry = "packages-space.openpra.org/p/openpra/containers/"
    val image = "openpra-monorepo"
    val remote = "$registry$image"

     host("Image Tags") {
       // use kotlinScript blocks for usage of parameters
       kotlinScript("Generate slugs") { api ->

         api.parameters["commitRef"] = api.gitRevision()
         api.parameters["gitBranch"] = api.gitBranch()

         val branchName = api.gitBranch()
           .removePrefix("refs/heads/")
           .replace(Regex("[^A-Za-z0-9-]"), "-") // Replace all non-alphanumeric characters except hyphens with hyphens
           .replace(Regex("-+"), "-") // Replace multiple consecutive hyphens with a single hyphen
           .lowercase() // Convert to lower case for consistency

         val maxSlugLength = if (branchName.length > 32) 32 else branchName.length

         var branchSlug = branchName.subSequence(0, maxSlugLength).toString()

         if (branchName == "main") {
           branchSlug = "v2-app"
           api.parameters["buildType"] = "production"
           api.parameters["debugMode"] = "false"
           api.parameters["isReview"] = "false"
         } else {
           branchSlug = "app-review-$branchSlug"
           api.parameters["buildType"] = "development"
           api.parameters["debugMode"] = "true"
           api.parameters["isReview"] = "true"
         }

         api.parameters["branchSlug"] = branchSlug
         api.parameters["externalLinkLabel"] = branchSlug
         api.parameters["externalLinkUrl"] = "$branchSlug.openpra.org"
       }
     }

    host("build-image") {
      shellScript {
        interpreter = "/bin/bash"
        content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --tag="$remote:{{ branchSlug }}" --tag="$remote:ci-{{ run:number }}-{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker push "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                        """
      }
    }

    parallel {

      host("frontend-web-editor:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run frontend-web-editor:build
                      """
        }
      }

      host("frontend-web-editor:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run frontend-web-editor:test || true
                      """
        }
      }

      host("frontend-web-editor:e2e") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run frontend-web-editor:e2e-cli || true
                      """
        }
      }

      host("frontend-web-editor:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run frontend-web-editor:lint || true
                      """
        }
      }


      host("web-backend:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run web-backend:build
                        """
        }
      }

      host("web-backend:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run web-backend:test || true
                        """
        }
      }

      host("web-backend:e2e") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run web-backend:e2e || true
                        """
        }
      }

      host("web-backend:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run web-backend:lint || true
                        """
        }
      }

      host("shared-types:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run shared-types:build
                        """
        }
      }

      host("shared-types:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run shared-types:test
                        """
        }
      }

      host("shared-types:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run shared-types:lint || true
                        """
        }
      }

      host("model-generator:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run model-generator:build
                        """
        }
      }

      host("model-generator:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run model-generator:test
                        """
        }
      }

      host("model-generator:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run model-generator:lint
                        """
        }
      }

      host("scram-node:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run engine-scram-node:build
                        """
        }
      }

      host("scram-node:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run engine-scram-node:test
                        """
        }
      }

      host("scram-node:ctest") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run engine-scram-node:ctest
                        """
        }
      }

      host("scram-node:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run engine-scram-node:lint
                        """
        }
      }

      host("mef-schema:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run mef-schema:build
                        """
        }
      }

      host("mef-schema:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run mef-schema:test
                        """
        }
      }

      host("mef-schema:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run mef-schema:lint
                        """
        }
      }

      host("microservice-job-broker:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run microservice-job-broker:build
                        """
        }
      }

      host("microservice-job-broker:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run microservice-job-broker:test
                        """
        }
      }

      host("microservice-job-broker:e2e") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run microservice-job-broker:e2e
                        """
        }
      }

      host("microservice-job-broker:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run microservice-job-broker:lint
                        """
        }
      }
    }
}
