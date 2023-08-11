import { Given } from '@cucumber/cucumber'
import assert from 'assert'

Given('I have {int} cukes', (count) => assert(count))
