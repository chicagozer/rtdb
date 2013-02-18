Logentries on OpenShift
======================

This git repo provides a quick method to get your OpenShift logs streaming to Logentries.

Running on OpenShift
----------------------------

Create a Logentries account at https://logentries.com/doc/openshift/

Take note of the Account-Key that you are given, you will need it in the Configuration step below.

Create an application on Openshift if you havent already, you must enter app name and your stack.

	rhc app create -a myappname -t mystack

Add this upstream Logentries repo

	cd myappname
	git remote add upstream -m master https://github.com/logentries/le_openshift.git
	git pull -s recursive -X theirs upstream master

Configuration
-------------

Configure logentries/le_config.ini file with your Logentries Account Key

Paste this inside the quotation marks in logentries/le_config.ini

Then push the repo

	git add .
	git commit -m "my first commit"
	git push

That's it, you can now check your logs, by logging into your Logentries account or refreshing the page.
