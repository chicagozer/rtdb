terraform {
  extra_arguments "vars" {
    commands = ["init","plan","refresh"]
# get_terraform_commands_that_need_vars()

    optional_var_files = [
      "${find_in_parent_folders("appversion.tfvars.json", "ignore")}"
    ]
  }
}
