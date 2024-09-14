job("Monorepo Deployment") {

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

       val maxSlugLength = if (branchName.length > 32) 32 else branchName.length

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
                           docker build --target frontend --build-arg BRANCH_SLUG="{{ branchSlug }}" --build-arg BUILD_TYPE="{{ buildType }}" --tag="$remote:frontend-{{ branchSlug }}" -f ./docker/Dockerfile .
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
                             docker build --target backend --build-arg BUILD_TYPE="{{ buildType }}" --tag="$remote:backend-{{ branchSlug }}" -f ./docker/Dockerfile .
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

job("Monorepo Deployment Cleanup") {

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

  host("Remove Stack") {
    requirements {
      workerTags("swarm-manager")
    }

    env["APP_NAME"] = "v2-app-{{ branchSlug }}"

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

    val registry = "packages.space.openpra.org/p/openpra/containers/"
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


    parallel {

      host("frontend-web-editor:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull $remote:{{ branchSlug }} || true
                      docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                      docker run --rm "$remote:{{ branchSlug }}" nx run frontend-web-editor:build
                      """
        }
      }

      host("frontend-web-editor:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull $remote:{{ branchSlug }} || true
                      docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                      docker run --rm "$remote:{{ branchSlug }}" nx run frontend-web-editor:test || true
                      """
        }
      }

      host("frontend-web-editor:e2e") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull $remote:{{ branchSlug }} || true
                      docker build --target=e2e-tests --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                      docker run --rm "$remote:{{ branchSlug }}" nx run frontend-web-editor:e2e-cli || true
                      """
        }
      }

      host("frontend-web-editor:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull $remote:{{ branchSlug }} || true
                      docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                      docker run --rm "$remote:{{ branchSlug }}" nx run frontend-web-editor:lint || true
                      """
        }
      }


      host("web-backend:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run web-backend:build
                        """
        }
      }

      host("web-backend:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run web-backend:test || true
                        """
        }
      }

      host("web-backend:e2e") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run web-backend:e2e || true
                        """
        }
      }

      host("web-backend:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run web-backend:lint || true
                        """
        }
      }

      host("shared-types:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run shared-types:build
                        """
        }
      }

      host("shared-types:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run shared-types:test
                        """
        }
      }

      host("shared-types:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run shared-types:lint || true
                        """
        }
      }

      host("model-generator:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run model-generator:build
                        """
        }
      }

      host("model-generator:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run model-generator:test
                        """
        }
      }

      host("model-generator:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run model-generator:lint
                        """
        }
      }

      host("scram-node:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run engine-scram-node:build
                        """
        }
      }

      host("scram-node:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run engine-scram-node:test
                        """
        }
      }

      host("scram-node:ctest") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run engine-scram-node:ctest
                        """
        }
      }

      host("scram-node:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run engine-scram-node:lint
                        """
        }
      }

      host("mef-schema:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run mef-schema:build
                        """
        }
      }

      host("mef-schema:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run mef-schema:test
                        """
        }
      }

      host("mef-schema:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run mef-schema:lint
                        """
        }
      }

      host("microservice-job-broker:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run microservice-job-broker:build
                        """
        }
      }

      host("microservice-job-broker:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run microservice-job-broker:test || true
                        """
        }
      }

      host("microservice-job-broker:e2e") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run microservice-job-broker:e2e
                        """
        }
      }

      host("microservice-job-broker:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --target=base --tag="$remote:{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker run --rm "$remote:{{ branchSlug }}" nx run microservice-job-broker:lint
                        """
        }
      }
    }
}

job("Monorepo Qodana") {

  failOn {
    nonZeroExitCode { enabled = false }
  }

  requirements {
    workerTags("swarm-worker")
  }

  val registry = "packages.space.openpra.org/p/openpra/containers/"
  val image = "monorepo-qodana"
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


  parallel {

    host("monorepo:qodana") {
      env["QODANA_TOKEN"] = "{{ project:QODANA_TOKEN }}"
      shellScript("scan") {
        interpreter = "/bin/bash"
        content = """
                      docker pull $remote:{{ branchSlug }} || true
                      docker build --tag="$remote:{{ branchSlug }}" -f ./docker/qodana.Dockerfile .
                      docker run --rm -e QODANA_TOKEN=${'$'}QODANA_TOKEN "$remote:{{ branchSlug }}"
                      """
      }
    }

    host("engine-scram-node:qodana") {
      env["QODANA_TOKEN"] = "{{ project:QODANA_TOKEN_ENGINE_SCRAM_NODE }}"
      shellScript("scan") {
        interpreter = "/bin/bash"
        content = """
                      docker pull $remote:{{ branchSlug }} || true
                      docker build --tag="$remote:{{ branchSlug }}" -f ./docker/qodana.Dockerfile .
                      docker run --rm -e QODANA_TOKEN=${'$'}QODANA_TOKEN "$remote:{{ branchSlug }}" engine/scram-node
                      """
      }
    }

    host("frontend-web-editor:qodana") {
      env["QODANA_TOKEN"] = "{{ project:QODANA_TOKEN_FRONTEND_WEB_EDITOR }}"
      shellScript("scan") {
        interpreter = "/bin/bash"
        content = """
                      docker pull $remote:{{ branchSlug }} || true
                      docker build --tag="$remote:{{ branchSlug }}" -f ./docker/qodana.Dockerfile .
                      docker run --rm -e QODANA_TOKEN=${'$'}QODANA_TOKEN "$remote:{{ branchSlug }}" frontend/web-editor
                      """
      }
    }

    host("mef-schema:qodana") {
      env["QODANA_TOKEN"] = "{{ project:QODANA_TOKEN_MEF_SCHEMA }}"
      shellScript("scan") {
        interpreter = "/bin/bash"
        content = """
                      docker pull $remote:{{ branchSlug }} || true
                      docker build --tag="$remote:{{ branchSlug }}" -f ./docker/qodana.Dockerfile .
                      docker run --rm -e QODANA_TOKEN=${'$'}QODANA_TOKEN "$remote:{{ branchSlug }}" mef-schema
                      """
      }
    }

    host("microservice-job-broker:qodana") {
      env["QODANA_TOKEN"] = "{{ project:QODANA_TOKEN_MICROSERVICE_JOB_BROKER }}"
      shellScript("scan") {
        interpreter = "/bin/bash"
        content = """
                      docker pull $remote:{{ branchSlug }} || true
                      docker build --tag="$remote:{{ branchSlug }}" -f ./docker/qodana.Dockerfile .
                      docker run --rm -e QODANA_TOKEN=${'$'}QODANA_TOKEN "$remote:{{ branchSlug }}" microservice-job-broker
                      """
      }
    }

    host("model-generator:qodana") {
      env["QODANA_TOKEN"] = "{{ project:QODANA_TOKEN_MODEL_GENERATOR }}"
      shellScript("scan") {
        interpreter = "/bin/bash"
        content = """
                      docker pull $remote:{{ branchSlug }} || true
                      docker build --tag="$remote:{{ branchSlug }}" -f ./docker/qodana.Dockerfile .
                      docker run --rm -e QODANA_TOKEN=${'$'}QODANA_TOKEN "$remote:{{ branchSlug }}" model-generator
                      """
      }
    }

    host("shared-types:qodana") {
      env["QODANA_TOKEN"] = "{{ project:QODANA_TOKEN_SHARED_TYPES }}"
      shellScript("scan") {
        interpreter = "/bin/bash"
        content = """
                      docker pull $remote:{{ branchSlug }} || true
                      docker build --tag="$remote:{{ branchSlug }}" -f ./docker/qodana.Dockerfile .
                      docker run --rm -e QODANA_TOKEN=${'$'}QODANA_TOKEN "$remote:{{ branchSlug }}" shared-types
                      """
      }
    }

    host("web-backend:qodana") {
      env["QODANA_TOKEN"] = "{{ project:QODANA_TOKEN_WEB_BACKEND }}"
      shellScript("scan") {
        interpreter = "/bin/bash"
        content = """
                      docker pull $remote:{{ branchSlug }} || true
                      docker build --tag="$remote:{{ branchSlug }}" -f ./docker/qodana.Dockerfile .
                      docker run --rm -e QODANA_TOKEN=${'$'}QODANA_TOKEN "$remote:{{ branchSlug }}" web-backend
                      """
      }
    }
  }
}
